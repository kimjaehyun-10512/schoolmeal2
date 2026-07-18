import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize Gemini SDK safely
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
} else {
  console.warn('⚠️ GEMINI_API_KEY environment variable is not defined.');
}

async function createServer() {
  const app = express();
  app.use(express.json());

  // API 1: School search
  app.get('/api/schools', async (req, res) => {
    try {
      const { name } = req.query;
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: '학교명을 입력해주세요.' });
      }

      // Query NEIS schoolInfo API
      const apiKey = process.env.NEIS_API_KEY;
      const keyParam = apiKey ? `&KEY=${apiKey}` : '';
      const url = `https://open.neis.go.kr/hub/schoolInfo?Type=json&pIndex=1&pSize=50&SCHUL_NM=${encodeURIComponent(name)}${keyParam}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`NEIS API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Check if data has search results
      if (!data.schoolInfo || data.schoolInfo.length < 2) {
        return res.json({ schools: [] });
      }

      const rows = data.schoolInfo[1].row;
      const schools = rows.map((row: any) => ({
        officeCode: row.ATPT_OFCDC_SC_CODE, // 시도교육청코드
        officeName: row.ATPT_OFCDC_SC_NM,   // 시도교육청명
        schoolCode: row.SD_SCHUL_CODE,      // 행정표준코드
        schoolName: row.SCHUL_NM,           // 학교명
        address: row.ORG_RDNMA,             // 도로명주소
        location: row.LCTN_SC_NM,           // 지역명
      }));

      res.json({ schools });
    } catch (error: any) {
      console.error('Error fetching school info:', error);
      res.status(500).json({ error: '학교 목록을 불러오는 중 오류가 발생했습니다.' });
    }
  });

  // API 2: Fetch school meal service info
  app.get('/api/meals', async (req, res) => {
    try {
      const { officeCode, schoolCode, date } = req.query;
      if (!officeCode || !schoolCode || !date) {
        return res.status(400).json({ error: '필수 파라미터가 누락되었습니다.' });
      }

      const apiKey = process.env.NEIS_API_KEY;
      const keyParam = apiKey ? `&KEY=${apiKey}` : '';
      const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&MLSV_YMD=${date}${keyParam}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`NEIS API error: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.mealServiceDietInfo || data.mealServiceDietInfo.length < 2) {
        return res.json({ meal: null });
      }

      const row = data.mealServiceDietInfo[1].row[0];
      
      // Parse DDISH_NM (meal menu dishes)
      // Usually comes in: "찰현미밥<br/>쇠고기미역국16.<br/>수제돈가스/소스1.2.5.6.10.12.13."
      const rawDishes = row.DDISH_NM || '';
      const dishes = rawDishes
        .split(/<br\s*\/?>/)
        .map((item: string) => item.trim())
        .filter((item: string) => item.length > 0)
        .map((item: string) => {
          // Extract allergy numbers (e.g. "쇠고기미역국16." or "수제돈가스1.2.5.")
          // Matches trailing digits and dots (e.g., 1.5.13.)
          const allergyRegex = /([0-9.]+)\.?$/;
          const match = item.match(allergyRegex);
          let name = item;
          let allergyCodes: string[] = [];

          if (match) {
            const rawCodes = match[1];
            // Split by dots and filter empty strings
            allergyCodes = rawCodes.split('.').filter(code => code.length > 0);
            // Clean name by removing the allergy code part from the end
            name = item.replace(allergyRegex, '').trim();
          }

          return {
            original: item,
            name,
            allergyCodes,
          };
        });

      res.json({
        meal: {
          schoolName: row.SCHUL_NM,
          mealType: row.MMEAL_SC_NM, // e.g. "중식"
          calories: row.CAL_INFO,     // e.g. "842 kcal"
          nutrition: row.NTR_INFO,   // e.g. "단백질(g) : 34.2..."
          originInfo: row.ORPLC_INFO, // 원산지 정보
          date: row.MLSV_YMD,
          dishes,
        }
      });
    } catch (error: any) {
      console.error('Error fetching meal info:', error);
      res.status(500).json({ error: '급식 정보를 불러오는 중 오류가 발생했습니다.' });
    }
  });

  // API 3: Get Gemini AI Commentary for meal menu
  app.post('/api/commentary', async (req, res) => {
    try {
      const { mealItems, schoolName, dateText, style = 'funny' } = req.body;
      if (!mealItems || !Array.isArray(mealItems) || mealItems.length === 0) {
        return res.status(400).json({ error: '메뉴 항목들이 필요합니다.' });
      }

      if (!ai) {
        return res.json({
          commentary: `오늘 급식은 ${mealItems.map(m => m.name).join(', ')} 이군요! 최고의 식단입니다. 군침이 싹 도네요! 😋 (현재 API 키가 등록되지 않아 한줄평 대체 모드로 표시됩니다)`,
          style: 'default',
        });
      }

      // Custom persona styles for variety and fun!
      let styleInstruction = '';
      switch (style) {
        case 'critic':
          styleInstruction = '미슐랭 3스타 평론가 스타일로, 아주 유아독존적이고 예술적인 어조로 품평해주세요.';
          break;
        case 'student':
          styleInstruction = '오늘 매점 안 가도 될 정도로 행복해하는 고등학생(식충이) 말투로, 트렌디한 급식체 학창시절 유행어나 슬랭을 섞어 신나게 작성해주세요. (예: "지렸다", "오늘 급식 폼 미쳤다")';
          break;
        case 'poetic':
          styleInstruction = '낭만적인 시인 스타일로, 한 편의 아름다운 시 구절처럼 감성적이고 감미롭게 작성해주세요.';
          break;
        case 'nutritionist':
          styleInstruction = '친절하고 따스한 영양사님 스타일로, 학생들의 건강을 격려하고 힘을 북돋아주는 말투로 작성해주세요.';
          break;
        default: // funny
          styleInstruction = '유쾌하고 드립력이 뛰어난 요리사 혹은 예능인 스타일로 작성해주세요. 배꼽 잡게 재미있는 드립이나 유머를 꼭 포함해야 합니다.';
      }

      const menuString = mealItems.map(item => item.name).join(', ');

      const prompt = `
학교명: ${schoolName || '학교'}
급식 날짜: ${dateText || '오늘'}
급식 메뉴: ${menuString}

[미션]
위에 제공된 급식 메뉴들을 분석해서 특별하고 재미있는 '급식 메뉴 한줄평'을 작성해줘.

[세부 규칙]
1. ${styleInstruction}
2. 2문장 이내로 짧고 강렬하게 써줘.
3. 무조건 한국어로 써줘.
4. 마크다운 기호(별표 등)나 해시태그는 절대 쓰지 말고, 따옴표 " " 로 감싼 텍스트만 출력해줘.
5. 영양소나 알레르기 수치는 직접 나열하기보다 전반적인 조합의 맛과 분위기에 초점을 맞춰서 맛깔나게 묘사해줘.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
      });

      let commentary = response.text || '';
      commentary = commentary.trim().replace(/^"|"$/g, ''); // Remove outer quotes if generated

      res.json({ commentary, style });
    } catch (error: any) {
      console.error('Error in Gemini API commentary generation:', error);
      res.status(500).json({ error: 'Gemini 한줄평 생성 중 오류가 발생했습니다.' });
    }
  });

  // Serve static assets or mount Vite dev middleware
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve built files
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port} (isProd: ${isProd})`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
