import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  Search, 
  RefreshCw, 
  Sparkles, 
  AlertCircle, 
  ArrowLeft, 
  ArrowRight, 
  School, 
  Smile, 
  MapPin,
  Heart,
  HelpCircle,
  Clock,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Utensils
} from 'lucide-react';

// Allergy Map for Korean School Lunch
const ALLERGY_MAP: Record<string, string> = {
  '1': '난류',
  '2': '우유',
  '3': '메밀',
  '4': '땅콩',
  '5': '대두',
  '6': '밀',
  '7': '고등어',
  '8': '게',
  '9': '새우',
  '10': '돼지고기',
  '11': '복숭아',
  '12': '토마토',
  '13': '아황산류',
  '14': '호두',
  '15': '닭고기',
  '16': '쇠고기',
  '17': '오징어',
  '18': '조개류 (굴/전복/홍합 등)',
  '19': '잣',
};

// Available AI Commentary Styles
interface PersonaStyle {
  id: string;
  name: string;
  emoji: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  hoverColor: string;
}

const PERSONA_STYLES: PersonaStyle[] = [
  { id: 'funny', name: '유쾌한 드립', emoji: '🤪', bgColor: 'bg-[#FF6B6B]', borderColor: 'border-[#FF6B6B]', textColor: 'text-white', hoverColor: 'hover:bg-[#ff5252]' },
  { id: 'critic', name: '미슐랭 평론', emoji: '🧐', bgColor: 'bg-[#4D96FF]', borderColor: 'border-[#4D96FF]', textColor: 'text-white', hoverColor: 'hover:bg-[#357ae8]' },
  { id: 'student', name: '킹받는 급식체', emoji: '🎒', bgColor: 'bg-[#FFD93D]', borderColor: 'border-[#FFD93D]', textColor: 'text-gray-900', hoverColor: 'hover:bg-[#eac424]' },
  { id: 'poetic', name: '감성 시인', emoji: '✍️', bgColor: 'bg-[#6BCB77]', borderColor: 'border-[#6BCB77]', textColor: 'text-white', hoverColor: 'hover:bg-[#52b15e]' },
  { id: 'nutritionist', name: '영양사쌤 격려', emoji: '👩‍🍳', bgColor: 'bg-[#9c27b0]', borderColor: 'border-[#9c27b0]', textColor: 'text-white', hoverColor: 'hover:bg-[#7b1fa2]' },
];

interface Dish {
  original: string;
  name: string;
  allergyCodes: string[];
}

interface Meal {
  schoolName: string;
  mealType: string;
  calories: string;
  nutrition: string;
  originInfo: string;
  date: string;
  dishes: Dish[];
}

interface SchoolItem {
  officeCode: string;
  officeName: string;
  schoolCode: string;
  schoolName: string;
  address: string;
  location: string;
}

// Default School (Seoul Science High School)
const DEFAULT_SCHOOL: SchoolItem = {
  officeCode: 'B10',
  officeName: '서울특별시교육청',
  schoolCode: '7010057',
  schoolName: '서울과학고등학교',
  address: '서울특별시 종로구 혜화로 63',
  location: '서울특별시',
};

export default function App() {
  // Date states
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());

  // School states
  const [currentSchool, setCurrentSchool] = useState<SchoolItem>(() => {
    const saved = localStorage.getItem('school_info');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return DEFAULT_SCHOOL;
      }
    }
    return DEFAULT_SCHOOL;
  });

  // Fetch states
  const [meal, setMeal] = useState<Meal | null>(null);
  const [loadingMeal, setLoadingMeal] = useState<boolean>(false);
  const [errorMeal, setErrorMeal] = useState<string | null>(null);

  // Gemini states
  const [commentary, setCommentary] = useState<string>('');
  const [loadingCommentary, setLoadingCommentary] = useState<boolean>(false);
  const [selectedStyle, setSelectedStyle] = useState<string>('funny');

  // Search Modal states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SchoolItem[]>([]);
  const [loadingSearch, setLoadingSearch] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Hover allergy description
  const [activeAllergy, setActiveAllergy] = useState<string | null>(null);

  // Save selected school to localStorage
  const handleSelectSchool = (school: SchoolItem) => {
    setCurrentSchool(school);
    localStorage.setItem('school_info', JSON.stringify(school));
    setIsModalOpen(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  // Helper to format date into YYYYMMDD
  const formatDateToYYYYMMDD = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  };

  // Fetch meal data from our server API
  const fetchMeal = async (school: SchoolItem, date: Date) => {
    const dateStr = formatDateToYYYYMMDD(date);
    setLoadingMeal(true);
    setErrorMeal(null);
    setMeal(null);
    setCommentary('');

    try {
      const response = await fetch(`/api/meals?officeCode=${school.officeCode}&schoolCode=${school.schoolCode}&date=${dateStr}`);
      if (!response.ok) {
        throw new Error('급식 정보를 가져오지 못했습니다.');
      }
      const data = await response.json();
      setMeal(data.meal);
    } catch (err: any) {
      setErrorMeal(err.message || '오류가 발생했습니다.');
    } finally {
      setLoadingMeal(false);
    }
  };

  // Fetch AI commentary
  const fetchCommentary = async (dishes: Dish[], styleId: string) => {
    if (!dishes || dishes.length === 0) return;
    setLoadingCommentary(true);
    setCommentary('');

    try {
      const dateText = `${selectedDate.getFullYear()}년 ${selectedDate.getMonth() + 1}월 ${selectedDate.getDate()}일`;
      const response = await fetch('/api/commentary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mealItems: dishes,
          schoolName: currentSchool.schoolName,
          dateText,
          style: styleId,
        }),
      });

      if (!response.ok) {
        throw new Error('Commentary generation failed');
      }

      const data = await response.json();
      setCommentary(data.commentary);
    } catch (err) {
      console.error(err);
      setCommentary('앗! 급식을 먹느라 바쁜지 Gemini가 잠시 자리를 비웠어요. 다시 한번 요청해보세요! 🍕');
    } finally {
      setLoadingCommentary(false);
    }
  };

  // Fetch school list
  const searchSchools = async () => {
    if (!searchQuery.trim()) return;
    setLoadingSearch(true);
    setSearchError(null);
    try {
      const response = await fetch(`/api/schools?name=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) {
        throw new Error('학교 검색에 실패했습니다.');
      }
      const data = await response.json();
      setSearchResults(data.schools || []);
      if (data.schools?.length === 0) {
        setSearchError('검색 결과가 없습니다. 다른 이름으로 검색해보세요!');
      }
    } catch (err: any) {
      setSearchError(err.message || '학교를 찾을 수 없습니다.');
    } finally {
      setLoadingSearch(false);
    }
  };

  // Trigger meal fetch on school or date change
  useEffect(() => {
    fetchMeal(currentSchool, selectedDate);
  }, [currentSchool, selectedDate]);

  // Trigger commentary fetch when meal changes or style changes
  useEffect(() => {
    if (meal && meal.dishes && meal.dishes.length > 0) {
      fetchCommentary(meal.dishes, selectedStyle);
    }
  }, [meal, selectedStyle]);

  // Calendar Helpers
  const handlePrevMonth = () => {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));
  };

  const generateCalendarDays = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();

    // First day of current month (0 = Sun, 1 = Mon, ...)
    const firstDayIndex = new Date(year, month, 1).getDay();
    // Total days in current month
    const totalDays = new Date(year, month + 1, 0).getDate();
    // Total days in previous month
    const prevTotalDays = new Date(year, month, 0).getDate();

    const days: { day: number; currentMonth: boolean; date: Date }[] = [];

    // Fill previous month grey days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevTotalDays - i;
      days.push({
        day: d,
        currentMonth: false,
        date: new Date(year, month - 1, d),
      });
    }

    // Fill current month days
    for (let i = 1; i <= totalDays; i++) {
      days.push({
        day: i,
        currentMonth: true,
        date: new Date(year, month, i),
      });
    }

    // Fill next month grey days to make full rows
    const remaining = 42 - days.length; // 6 rows * 7 columns = 42
    for (let i = 1; i <= remaining; i++) {
      days.push({
        day: i,
        currentMonth: false,
        date: new Date(year, month + 1, i),
      });
    }

    return days;
  };

  const daysGrid = generateCalendarDays();

  // Helper to format weekday string
  const getWeekdayString = (date: Date) => {
    const weekdays = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    return weekdays[date.getDay()];
  };

  return (
    <div id="app-root" className="min-h-screen flex flex-col md:flex-row bg-[#FFF9E6] font-sans text-[#2D3436]">
      
      {/* LEFT SIDEBAR: Calendar & Current School */}
      <aside id="sidebar" className="w-full md:w-85 border-b-4 md:border-b-0 md:border-r-4 border-[#FFD93D] bg-white flex flex-col p-6 shrink-0 shadow-[4px_0px_0px_0px_rgba(45,52,54,0.1)]">
        
        {/* Brand Header */}
        <div className="mb-8" id="sidebar-header">
          <div className="flex items-center space-x-2 mb-2 text-[#FF6B6B]" id="brand-tagline">
            <div className="w-3 h-3 rounded-full bg-current animate-pulse"></div>
            <span className="font-black uppercase tracking-widest text-xs">Meal Planner</span>
          </div>
          <h1 className="text-3xl font-black text-[#2D3436] leading-tight" id="app-title">
            오늘의<br/>맛있는 급식
          </h1>
        </div>

        {/* School Display Panel */}
        <div className="mb-8 bg-[#F1F2F6] rounded-2xl border-4 border-[#2D3436] p-4 flex flex-col space-y-2 relative shadow-[4px_4px_0px_0px_rgba(45,52,54,1)]" id="school-panel">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Active School</span>
            <span className="px-1.5 py-0.5 bg-[#6BCB77] text-white rounded text-[9px] font-black uppercase tracking-tighter">NEIS Connected</span>
          </div>
          <div>
            <p className="text-lg font-black text-[#2D3436] leading-snug flex items-center gap-1.5">
              <School className="w-5 h-5 text-[#4D96FF] shrink-0" />
              {currentSchool.schoolName}
            </p>
            <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
              <MapPin className="w-3 h-3 shrink-0" />
              {currentSchool.address || `${currentSchool.location} 교육청`}
            </p>
          </div>
          <button 
            id="change-school-btn"
            onClick={() => setIsModalOpen(true)}
            className="w-full mt-2 py-2.5 bg-[#FFD93D] text-gray-900 border-2 border-[#2D3436] rounded-xl font-bold text-xs hover:bg-[#ffe169] transition active:scale-95 flex items-center justify-center gap-1 shadow-[2px_2px_0px_0px_rgba(45,52,54,1)] cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            학교 변경하기
          </button>
        </div>

        {/* Custom Retro Calendar Widget */}
        <div className="flex-1 flex flex-col" id="calendar-widget">
          <div className="flex items-center justify-between mb-4">
            <span className="font-black text-sm text-[#2D3436]">
              {calendarMonth.getFullYear()}년 {calendarMonth.getMonth() + 1}월
            </span>
            <div className="flex space-x-1.5">
              <button 
                onClick={handlePrevMonth}
                className="p-1 rounded-lg bg-[#F1F2F6] hover:bg-[#E4E5E9] active:scale-90 transition text-xs border border-[#2D3436] cursor-pointer"
                title="이전 달"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={() => {
                  const today = new Date();
                  setSelectedDate(today);
                  setCalendarMonth(today);
                }}
                className="px-2 py-1 bg-[#F1F2F6] hover:bg-[#E4E5E9] active:scale-90 transition text-[10px] font-bold border border-[#2D3436] rounded-lg cursor-pointer"
              >
                오늘
              </button>
              <button 
                onClick={handleNextMonth}
                className="p-1 rounded-lg bg-[#F1F2F6] hover:bg-[#E4E5E9] active:scale-90 transition text-xs border border-[#2D3436] cursor-pointer"
                title="다음 달"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-black text-gray-400 mb-2">
            <span className="text-[#FF6B6B]">일</span>
            <span>월</span>
            <span>화</span>
            <span>수</span>
            <span>목</span>
            <span>금</span>
            <span className="text-[#4D96FF]">토</span>
          </div>

          <div className="grid grid-cols-7 gap-1 flex-1">
            {daysGrid.map((item, idx) => {
              const isSelected = 
                selectedDate.getDate() === item.date.getDate() && 
                selectedDate.getMonth() === item.date.getMonth() && 
                selectedDate.getFullYear() === item.date.getFullYear();
              
              const isToday = 
                new Date().getDate() === item.date.getDate() &&
                new Date().getMonth() === item.date.getMonth() &&
                new Date().getFullYear() === item.date.getFullYear();

              const isSunday = item.date.getDay() === 0;
              const isSaturday = item.date.getDay() === 6;

              let textClass = 'text-gray-800';
              if (!item.currentMonth) {
                textClass = 'text-gray-300';
              } else if (isSunday) {
                textClass = 'text-[#FF6B6B]';
              } else if (isSaturday) {
                textClass = 'text-[#4D96FF]';
              }

              return (
                <button
                  key={idx}
                  onClick={() => {
                    setSelectedDate(item.date);
                    if (!item.currentMonth) {
                      setCalendarMonth(item.date);
                    }
                  }}
                  className={`h-9 flex flex-col items-center justify-center rounded-xl font-bold text-xs relative cursor-pointer border-2 transition-all group ${
                    isSelected 
                      ? 'bg-[#4D96FF] text-white border-[#2D3436] shadow-[2px_2px_0px_0px_rgba(45,52,54,1)] scale-105 z-10' 
                      : 'border-transparent hover:border-[#FFD93D] hover:bg-[#FFF9E6]'
                  }`}
                >
                  <span className={`${textClass} ${isSelected ? 'text-white font-black' : ''}`}>
                    {item.day}
                  </span>
                  
                  {isToday && !isSelected && (
                    <div className="absolute bottom-1 w-1 h-1 rounded-full bg-[#FF6B6B]"></div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Creator Info / Help Footer in Sidebar */}
        <div className="mt-8 pt-4 border-t border-gray-100" id="sidebar-footer">
          <div className="flex items-center space-x-2 text-[10px] text-gray-400 font-bold justify-center uppercase tracking-wider">
            <span>Made with Gemini & NEIS API</span>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA: Food list & AI Commentary */}
      <main id="main-content" className="flex-1 p-6 md:p-10 flex flex-col space-y-8 overflow-y-auto">
        
        {/* Header Meta Info */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4" id="content-header">
          <div>
            <p className="text-[#6BCB77] font-black text-lg md:text-xl mb-1 flex items-center gap-1.5">
              <CalendarIcon className="w-5 h-5 text-[#6BCB77]" />
              {`${selectedDate.getMonth() + 1}월 ${selectedDate.getDate()}일 ${getWeekdayString(selectedDate)}`}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 bg-[#FFD93D] border-2 border-[#2D3436] rounded-full text-xs font-black shadow-[2px_2px_0px_0px_rgba(45,52,54,1)]">
                {meal ? meal.calories || '칼로리 정보 없음' : '급식 정보 없음'}
              </span>
              <span className="px-3 py-1 bg-[#6BCB77] border-2 border-[#2D3436] rounded-full text-xs font-black text-white shadow-[2px_2px_0px_0px_rgba(45,52,54,1)]">
                {meal ? meal.mealType : '미운영'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center space-x-2" id="ai-status-badge">
            <span className="text-[10px] bg-[#2D3436] text-white px-3 py-1.5 rounded-xl border border-black tracking-widest font-black uppercase shadow-sm">
              GEMINI 3.5 FLASH ACTIVE
            </span>
          </div>
        </div>

        {/* LOADING STATE */}
        {loadingMeal && (
          <div className="bg-white rounded-[40px] border-4 border-[#2D3436] shadow-[12px_12px_0px_0px_rgba(45,52,54,1)] p-8 flex flex-col items-center justify-center min-h-[300px]" id="meal-loading">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-dashed border-[#FFD93D] rounded-full animate-spin"></div>
              <Utensils className="w-6 h-6 text-[#FF6B6B] absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-bounce" />
            </div>
            <p className="mt-6 text-lg font-black text-[#2D3436]">나이스 교육망에서 오늘의 식단을 가져오는 중...</p>
            <p className="text-xs text-gray-400 mt-1">네트워크 환경에 따라 잠시 시간이 소요될 수 있습니다.</p>
          </div>
        )}

        {/* ERROR STATE */}
        {!loadingMeal && errorMeal && (
          <div className="bg-white rounded-[40px] border-4 border-[#2D3436] shadow-[12px_12px_0px_0px_rgba(45,52,54,1)] p-8 flex flex-col items-center justify-center min-h-[300px]" id="meal-error">
            <div className="w-16 h-16 bg-[#FF6B6B] border-4 border-[#2D3436] rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-md">
              <AlertCircle className="w-8 h-8" />
            </div>
            <p className="mt-6 text-xl font-black text-[#2D3436]">식단을 불러오는 데 실패했습니다.</p>
            <p className="text-sm text-gray-500 mt-2 text-center max-w-md">{errorMeal}</p>
            <button 
              onClick={() => fetchMeal(currentSchool, selectedDate)}
              className="mt-6 px-6 py-2 bg-[#FFD93D] border-2 border-[#2D3436] font-bold text-sm rounded-xl hover:bg-[#ffe169] active:scale-95 shadow-[4px_4px_0px_0px_rgba(45,52,54,1)] cursor-pointer"
            >
              다시 시도하기
            </button>
          </div>
        )}

        {/* NO MEAL (EMPTY STATE) */}
        {!loadingMeal && !errorMeal && !meal && (
          <div className="bg-white rounded-[40px] border-4 border-[#2D3436] shadow-[12px_12px_0px_0px_rgba(45,52,54,1)] p-8 flex flex-col items-center justify-center min-h-[320px]" id="meal-empty">
            <div className="w-16 h-16 bg-[#FFF9E6] border-4 border-[#2D3436] rounded-full flex items-center justify-center text-3xl shadow-[3px_3px_0px_0px_rgba(45,52,54,1)]">
              🏖️
            </div>
            <p className="mt-6 text-xl font-black text-[#2D3436]">오늘은 급식이 없는 날이에요!</p>
            <p className="text-sm text-gray-500 mt-2 text-center max-w-md">
              선택한 날짜({selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일)는 주말, 휴업일 혹은 방학 기간일 수 있습니다. 다른 날짜나 학교를 선택해보세요!
            </p>
            
            {/* Fun Gemini Empty State Message */}
            <div className="mt-6 p-4 bg-[#F1F2F6] rounded-2xl border-2 border-dashed border-[#2D3436] text-center w-full max-w-md">
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1">💡 Gemini의 주말 추천 한줄평</p>
              <p className="text-sm font-bold text-[#2D3436] italic">
                "급식이 없다면 오늘은 역시 정크푸드 타임! 🍕 집에서 뒹굴거리며 엽떡이나 치킨을 시켜 먹는 것은 어떨까요? 월요일에 신나게 급식실에서 만나요!"
              </p>
            </div>
          </div>
        )}

        {/* MEAL SERVICE CONTENT */}
        {!loadingMeal && !errorMeal && meal && (
          <div className="grid grid-cols-1 gap-8" id="meal-view">
            
            {/* 1. Primary Menu Card */}
            <div className="bg-white rounded-[40px] border-4 border-[#2D3436] shadow-[12px_12px_0px_0px_rgba(45,52,54,1)] p-6 md:p-8 flex flex-col min-h-[320px] transition-transform hover:scale-[1.01] duration-300 relative" id="meal-card">
              
              <h3 className="text-xl font-black mb-6 flex items-center text-[#2D3436]">
                <span className="w-10 h-10 flex items-center justify-center bg-[#FFD93D] border-2 border-[#2D3436] rounded-full mr-3 text-lg shadow-[2px_2px_0px_0px_rgba(45,52,54,1)]">🍱</span>
                오늘의 식단 메뉴
              </h3>

              {/* Dishes Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                {meal.dishes.map((dish, idx) => (
                  <div 
                    key={idx} 
                    className="p-3 bg-[#F8F9FA] rounded-2xl border-2 border-[#2D3436] hover:bg-[#FFF9E6] transition duration-200 flex items-center justify-between shadow-[2px_2px_0px_0px_rgba(45,52,54,1)] group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 rounded-full bg-[#FFD93D] border border-[#2D3436] shrink-0 group-hover:scale-125 transition-transform"></div>
                      <span className="text-base md:text-lg font-black text-[#2D3436]">
                        {dish.name}
                      </span>
                    </div>

                    {/* Allergy Badges */}
                    {dish.allergyCodes.length > 0 && (
                      <div className="flex flex-wrap gap-1 justify-end max-w-[120px]">
                        {dish.allergyCodes.map((code) => (
                          <div
                            key={code}
                            onMouseEnter={() => setActiveAllergy(code)}
                            onMouseLeave={() => setActiveAllergy(null)}
                            onClick={() => setActiveAllergy(activeAllergy === code ? null : code)}
                            className={`w-5 h-5 flex items-center justify-center rounded-full text-[9px] font-black border border-[#2D3436] shadow-[1px_1px_0px_0px_rgba(45,52,54,1)] transition-transform hover:-translate-y-0.5 cursor-pointer select-none ${
                              activeAllergy === code 
                                ? 'bg-[#FF6B6B] text-white scale-110' 
                                : 'bg-[#E4E5E9] text-[#2D3436]'
                            }`}
                            title={`${code}: ${ALLERGY_MAP[code] || '기타'}`}
                          >
                            {code}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Interactive Allergy Tooltip/Legend */}
              <div className="mt-6 pt-4 border-t-2 border-dashed border-gray-200 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500" id="allergy-legend">
                <div className="flex items-center gap-1">
                  <HelpCircle className="w-4 h-4 text-gray-400" />
                  <span>메뉴명 끝의 숫자는 <strong>알레르기 정보</strong>입니다. 마우스나 터치로 숫자를 확인해보세요!</span>
                </div>
                {activeAllergy && (
                  <div className="bg-[#FF6B6B] text-white border-2 border-[#2D3436] px-3 py-1 rounded-xl font-bold animate-bounce shadow-md">
                    알레르기 {activeAllergy}번: <strong className="underline">{ALLERGY_MAP[activeAllergy] || '확인 불가'}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* 2. AI Commentary Section */}
            <div className="bg-[#4D96FF] rounded-[40px] border-4 border-[#2D3436] shadow-[12px_12px_0px_0px_rgba(45,52,54,1)] p-6 md:p-8 flex flex-col relative overflow-hidden" id="ai-commentary-card">
              
              {/* Decorative Background Icon */}
              <div className="absolute -right-6 -bottom-6 opacity-10 transform -rotate-12 pointer-events-none">
                <svg width="220" height="220" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5-9h10v2H7z"/>
                </svg>
              </div>

              {/* Title & Style Select Tabs */}
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 relative z-10">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center mr-3 shadow-[2px_2px_0px_0px_rgba(45,52,54,1)] border-2 border-[#2D3436]">
                    <Sparkles className="w-5 h-5 text-[#FF6B6B] animate-spin" style={{ animationDuration: '6s' }} />
                  </div>
                  <h3 className="text-xl font-black text-white drop-shadow">Gemini의 급식 한줄평</h3>
                </div>

                {/* Persona Style Buttons */}
                <div className="flex flex-wrap gap-1.5 bg-black/20 p-1.5 rounded-2xl" id="persona-selector">
                  {PERSONA_STYLES.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setSelectedStyle(style.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1 cursor-pointer ${
                        selectedStyle === style.id 
                          ? 'bg-white text-gray-900 shadow-md border-2 border-[#2D3436] scale-105' 
                          : 'text-white/80 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <span>{style.emoji}</span>
                      <span>{style.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Generated Commentary Display */}
              <div className="flex-1 flex flex-col justify-center items-center py-6 px-4 min-h-[140px] bg-white/10 border-2 border-dashed border-white/20 rounded-3xl relative z-10" id="commentary-body">
                {loadingCommentary ? (
                  <div className="flex flex-col items-center space-y-3" id="commentary-loading">
                    <div className="flex space-x-2">
                      <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                    <p className="text-sm font-bold text-white/90">Gemini가 메뉴를 한술 더 뜨며 음미하는 중...</p>
                  </div>
                ) : (
                  <div className="text-center max-w-2xl" id="commentary-content">
                    <p className="text-xl md:text-2xl font-black text-white leading-relaxed italic drop-shadow-sm">
                      "{commentary}"
                    </p>
                  </div>
                )}
              </div>

              {/* Re-commentary Option */}
              <div className="flex justify-between items-center mt-4 pt-2 relative z-10">
                <div className="px-4 py-1.5 bg-white/20 rounded-full border border-white/40">
                  <p className="text-[10px] text-white font-black tracking-wider uppercase">AI Generated Commentary • Personal Taste</p>
                </div>

                <button 
                  onClick={() => fetchCommentary(meal.dishes, selectedStyle)}
                  disabled={loadingCommentary}
                  className="px-4 py-2 bg-white border-2 border-[#2D3436] rounded-xl text-xs font-black text-gray-900 shadow-[3px_3px_0px_0px_rgba(45,52,54,1)] hover:bg-[#FFF9E6] transition active:scale-95 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingCommentary ? 'animate-spin' : ''}`} />
                  한줄평 새로고침 ✨
                </button>
              </div>

            </div>

            {/* Nutrition & Origin details - Bento grid detail cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="bento-extra">
              
              {/* Origin information */}
              <div className="bg-[#6BCB77] text-white rounded-[30px] border-4 border-[#2D3436] shadow-[8px_8px_0px_0px_rgba(45,52,54,1)] p-5 relative overflow-hidden flex flex-col justify-between">
                <div>
                  <h4 className="text-md font-black mb-2 flex items-center gap-1.5">
                    🌱 주요 원산지 정보
                  </h4>
                  <p className="text-xs text-white/90 leading-relaxed font-bold max-h-[120px] overflow-y-auto pr-2">
                    {meal.originInfo ? meal.originInfo.replace(/<br\s*\/?>/g, ', ') : '원산지 정보가 제공되지 않는 학교입니다.'}
                  </p>
                </div>
                <div className="text-[10px] text-black/40 font-black mt-4 uppercase">
                  Healthy & Eco-Friendly Ingredients
                </div>
              </div>

              {/* Nutrition information */}
              <div className="bg-[#FFD93D] text-[#2D3436] rounded-[30px] border-4 border-[#2D3436] shadow-[8px_8px_0px_0px_rgba(45,52,54,1)] p-5 relative overflow-hidden flex flex-col justify-between">
                <div>
                  <h4 className="text-md font-black mb-2 flex items-center gap-1.5 text-[#2D3436]">
                    💪 영양성분 정보
                  </h4>
                  <p className="text-xs text-[#2D3436]/90 leading-relaxed font-bold max-h-[120px] overflow-y-auto pr-2">
                    {meal.nutrition ? meal.nutrition.replace(/<br\s*\/?>/g, ', ') : '영양소 분석 데이터가 비어 있습니다.'}
                  </p>
                </div>
                <div className="text-[10px] text-black/40 font-black mt-4 uppercase">
                  Balanced Nutrients Daily Goal
                </div>
              </div>

            </div>

          </div>
        )}

      </main>

      {/* SCHOOL SEARCH MODAL (Retro Brutalism style dialog) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="search-modal-backdrop">
          <div className="w-full max-w-lg bg-[#FFF9E6] rounded-[32px] border-4 border-[#2D3436] shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] p-6 relative flex flex-col max-h-[85vh]" id="search-modal">
            
            {/* Header */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-2xl font-black text-[#2D3436] flex items-center gap-2">
                  <School className="w-6 h-6 text-[#FF6B6B]" />
                  나이스 학교 검색
                </h3>
                <p className="text-xs font-bold text-gray-500 mt-1">전국의 모든 초·중·고등학교 급식을 검색할 수 있습니다.</p>
              </div>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setSearchQuery('');
                  setSearchResults([]);
                  setSearchError(null);
                }}
                className="w-8 h-8 rounded-full border-2 border-[#2D3436] bg-[#FF6B6B] text-white font-black flex items-center justify-center hover:bg-[#ff5252] transition active:scale-90 cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            {/* Input query field */}
            <div className="relative mb-6">
              <input
                type="text"
                placeholder="학교명을 입력하세요 (예: 서울과학, 제주제일, 한빛)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') searchSchools();
                }}
                className="w-full py-3 pl-4 pr-12 bg-white border-4 border-[#2D3436] rounded-2xl font-bold text-sm text-[#2D3436] focus:outline-none focus:ring-2 focus:ring-[#4D96FF] shadow-[4px_4px_0px_0px_rgba(45,52,54,1)] placeholder-gray-400"
              />
              <button
                onClick={searchSchools}
                disabled={loadingSearch}
                className="absolute right-2.5 top-1/2 transform -translate-y-1/2 p-2 bg-[#FFD93D] hover:bg-[#ffe169] border-2 border-[#2D3436] rounded-xl transition duration-150 active:scale-95 cursor-pointer flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(45,52,54,1)]"
              >
                <Search className="w-4 h-4 text-[#2D3436]" />
              </button>
            </div>

            {/* Loading Indicator */}
            {loadingSearch && (
              <div className="flex-1 flex flex-col items-center justify-center py-10" id="search-loading">
                <div className="w-10 h-10 border-4 border-[#FF6B6B] border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-3 text-sm font-bold text-gray-500">교육정보포털에서 검색 중...</p>
              </div>
            )}

            {/* Error Message */}
            {searchError && !loadingSearch && (
              <div className="p-4 bg-red-50 border-2 border-[#FF6B6B] rounded-2xl flex items-center space-x-3 text-[#FF6B6B] text-sm font-bold mb-4" id="search-error">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{searchError}</span>
              </div>
            )}

            {/* School list */}
            {!loadingSearch && searchResults.length > 0 && (
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[40vh]" id="search-results-list">
                <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider">검색된 학교 목록 ({searchResults.length}건)</p>
                
                {searchResults.map((school, index) => (
                  <button
                    key={`${school.schoolCode}-${index}`}
                    onClick={() => handleSelectSchool(school)}
                    className="w-full text-left p-3.5 bg-white border-2 border-[#2D3436] rounded-2xl hover:bg-[#FFD93D] transition flex items-center justify-between cursor-pointer group shadow-[3px_3px_0px_0px_rgba(45,52,54,1)] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_rgba(45,52,54,1)]"
                  >
                    <div className="flex-1 pr-4">
                      <div className="flex items-center space-x-2">
                        <span className="font-black text-base text-[#2D3436] group-hover:text-black">
                          {school.schoolName}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 bg-[#4D96FF] text-white font-black rounded-lg shrink-0">
                          {school.officeName}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1 group-hover:text-gray-700">
                        <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                        {school.address}
                      </p>
                    </div>
                    
                    <div className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300 group-hover:border-black group-hover:bg-white flex items-center justify-center transition shrink-0">
                      <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-black" />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Placeholder Empty info */}
            {!loadingSearch && searchResults.length === 0 && !searchError && (
              <div className="flex-1 flex flex-col items-center justify-center py-10 border-2 border-dashed border-gray-300 rounded-2xl bg-white/50" id="search-placeholder">
                <School className="w-10 h-10 text-gray-300 mb-2" />
                <p className="text-sm font-bold text-gray-400">전국 학교 이름의 일부를 검색창에 입력해 보세요!</p>
                <p className="text-[11px] text-gray-400/80 mt-1">예: "대명", "성동", "제일고"</p>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
