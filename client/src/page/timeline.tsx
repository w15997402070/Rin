import {useEffect, useRef, useState} from "react"
import {Helmet} from 'react-helmet'
import {Link} from "wouter"
import {Waiting} from "../components/loading"
import { client } from "../app/runtime"
import {useSiteConfig} from "../hooks/useSiteConfig";
import {siteName} from "../utils/constants"
import {useTranslation} from "react-i18next";

interface FeedItem {
    id: number;
    createdAt: Date;
    title: string | null;
}

export function TimelinePage() {
    const [rawFeeds, setRawFeeds] = useState<FeedItem[]>([])
    const [feeds, setFeeds] = useState<Partial<Record<number, FeedItem[]>>>()
    const [selectedDate, setSelectedDate] = useState<Date | null>(null)
    const [length, setLength] = useState(0)
    const ref = useRef(false)
    const { t } = useTranslation()
    const siteConfig = useSiteConfig();

    function fetchFeeds() {
        client.feed.timeline()
        .then(({ data }) => {
            if (data) {
                const arr = (Array.isArray(data) ? data : []).map(item => ({
                    ...item,
                    createdAt: new Date(item.createdAt)
                }));
                setRawFeeds(arr);
            }
        })
        .catch(err => {
            console.error("fetchFeeds error:", err)
        })
    }

    useEffect(() => {
        if (ref.current) return
        fetchFeeds()
        ref.current = true
    }, [])

    // Filter and group feeds when rawFeeds or selectedDate changes
    useEffect(() => {
        let filtered = rawFeeds;
        if (selectedDate) {
            filtered = rawFeeds.filter(item => {
                const itemDate = new Date(item.createdAt);
                return itemDate.getFullYear() === selectedDate.getFullYear() &&
                       itemDate.getMonth() === selectedDate.getMonth() &&
                       itemDate.getDate() === selectedDate.getDate();
            });
        }

        setLength(filtered.length);

        const groups = (Object.groupBy
            ? Object.groupBy(filtered, ({ createdAt }) => new Date(createdAt).getFullYear())
            : filtered.reduce<Record<number, any[]>>((acc, item) => {
                const key = new Date(item.createdAt).getFullYear()
                ;(acc[key] ||= []).push(item)
                return acc
            }, {})
        )

        setFeeds(groups as any)
    }, [selectedDate, rawFeeds]);

    return (
        <>
            <Helmet>
                <title>{`${t('timeline')} - ${siteConfig.name}`}</title>
                <meta property="og:site_name" content={siteName} />
                <meta property="og:title" content={t('timeline')} />
                <meta property="og:image" content={siteConfig.avatar} />
                <meta property="og:type" content="article" />
                <meta property="og:url" content={document.URL} />
            </Helmet>
            <Waiting for={feeds}>
                <main className="w-full max-w-6xl mx-auto flex flex-col lg:flex-row lg:space-x-8 px-4 mb-8 ani-show">
                    {/* Left: Calendar Column */}
                    <div className="w-full lg:w-80 shrink-0 mb-6 lg:mb-0">
                        <Calendar 
                            rawFeeds={rawFeeds} 
                            selectedDate={selectedDate} 
                            setSelectedDate={setSelectedDate} 
                        />
                    </div>

                    {/* Right: Timeline List Column */}
                    <div className="flex-1 w-full flex flex-col items-center">
                        <div className="wauto text-start text-black dark:text-white py-4 text-4xl font-bold w-full">
                            <p>
                                {t('timeline')}
                            </p>
                            <div className="flex flex-row justify-between">
                                <p className="text-sm mt-4 text-neutral-500 font-normal">
                                    {selectedDate 
                                        ? `${selectedDate.getFullYear()}年${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日下共有 ${length} 篇文章` 
                                        : t('article.total$count', { count: length })}
                                </p>
                            </div>
                        </div>
                        
                        {feeds && Object.keys(feeds).sort((a, b) => parseInt(b) - parseInt(a)).map(year => (
                            <div key={year} className="wauto flex flex-col justify-center items-start w-full">
                                <h1 className="flex flex-row items-center space-x-2">
                                    <span className="text-2xl font-bold t-primary ">
                                        {t('year$year', { year: year })}
                                    </span>
                                    <span className="text-sm t-secondary">
                                        {t('article.total_short$count', { count: feeds[+year]?.length })}
                                    </span>
                                </h1>
                                <div className="w-full flex flex-col justify-center items-start my-4">
                                    {feeds[+year]?.map(({ id, title, createdAt }) => (
                                        <FeedItem key={id} id={id.toString()} title={title || t('unlisted')}
                                                  createdAt={new Date(createdAt)}/>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </main>
            </Waiting>
        </>
    )
}

function Calendar({ rawFeeds, selectedDate, setSelectedDate }: { 
    rawFeeds: FeedItem[], 
    selectedDate: Date | null, 
    setSelectedDate: (d: Date | null) => void 
}) {
    const [viewDate, setViewDate] = useState(new Date());
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
    const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

    const totalDays = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const daysGrid: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) {
        daysGrid.push(null);
    }
    for (let d = 1; d <= totalDays; d++) {
        daysGrid.push(new Date(year, month, d));
    }

    const hasArticleOnDate = (date: Date) => {
        return rawFeeds.some(feed => {
            const feedDate = new Date(feed.createdAt);
            return feedDate.getFullYear() === date.getFullYear() &&
                   feedDate.getMonth() === date.getMonth() &&
                   feedDate.getDate() === date.getDate();
        });
    };

    const isToday = (date: Date) => {
        const today = new Date();
        return today.getFullYear() === date.getFullYear() &&
               today.getMonth() === date.getMonth() &&
               today.getDate() === date.getDate();
    };

    return (
        <div className="bg-w p-5 rounded-2xl border border-neutral-100 dark:border-neutral-800/60 shadow-sm w-full select-none">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
                <button 
                    type="button" 
                    onClick={() => setViewDate(new Date(year, month - 1))}
                    className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors duration-200 active:scale-95"
                >
                    <i className="ri-arrow-left-s-line text-lg t-secondary hover:t-primary"></i>
                </button>
                <span className="font-bold text-base t-primary">
                    {year}年 {month + 1}月
                </span>
                <button 
                    type="button" 
                    onClick={() => setViewDate(new Date(year, month + 1))}
                    className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors duration-200 active:scale-95"
                >
                    <i className="ri-arrow-right-s-line text-lg t-secondary hover:t-primary"></i>
                </button>
            </div>

            {/* Week Labels */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-neutral-400 mb-2">
                <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7 gap-1 text-center">
                {daysGrid.map((date, idx) => {
                    if (!date) return <div key={`empty-${idx}`} className="h-10 w-10 mx-auto" />;

                    const hasArticle = hasArticleOnDate(date);
                    const isSelected = selectedDate && 
                        selectedDate.getFullYear() === date.getFullYear() &&
                        selectedDate.getMonth() === date.getMonth() &&
                        selectedDate.getDate() === date.getDate();
                    const activeToday = isToday(date);

                    return (
                        <button
                            key={date.toISOString()}
                            type="button"
                            onClick={() => {
                                if (hasArticle) {
                                    isSelected ? setSelectedDate(null) : setSelectedDate(date);
                                }
                            }}
                            className={`
                                relative p-2 text-sm rounded-xl transition-all duration-200 flex flex-col items-center justify-center h-10 w-10 mx-auto
                                ${isSelected ? 'bg-theme text-white font-bold' : 't-primary hover:bg-neutral-100 dark:hover:bg-neutral-800'}
                                ${activeToday && !isSelected ? 'border border-theme text-theme font-bold' : ''}
                                ${!hasArticle ? 'opacity-20 cursor-default pointer-events-none' : 'font-semibold cursor-pointer active:scale-90'}
                            `}
                            title={hasArticle ? '查看该日文章' : ''}
                        >
                            <span>{date.getDate()}</span>
                            {hasArticle && !isSelected && (
                                <span className="absolute bottom-1 w-1 h-1 bg-theme rounded-full"></span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Reset */}
            {selectedDate && (
                <button
                    type="button"
                    onClick={() => setSelectedDate(null)}
                    className="mt-4 w-full py-2 bg-theme-light dark:bg-theme/10 text-theme text-xs font-semibold rounded-xl hover:opacity-90 active:scale-95 transition-all duration-200"
                >
                    清除日期筛选
                </button>
            )}
        </div>
    );
}

export function FeedItem({ id, title, createdAt }: { id: string, title: string, createdAt: Date }) {
    const formatter = new Intl.DateTimeFormat('en-US', { day: '2-digit', month: '2-digit' });
    return (
        <div className="flex flex-row pl-8">
            <div className="flex flex-row items-center">
                <div className="w-2 h-2 bg-theme rounded-full"></div>
            </div>
            <div className="flex-1 rounded-2xl m-2 duration-300 flex flex-row items-center space-x-4   ">
                <span className="t-secondary text-sm" title={new Date(createdAt).toLocaleString()}>
                    {formatter.format(new Date(createdAt))}
                </span>
                <Link href={`/feed/${id}`} target="_blank" className="text-base t-primary hover:text-theme text-pretty overflow-hidden">
                    {title}
                </Link>
            </div>
        </div>
    )
}
