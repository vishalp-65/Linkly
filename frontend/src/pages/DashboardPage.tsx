import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import URLShortenerForm from '../components/URLShortenerForm';
import Card from '../components/common/Card';
import { useGetUserUrlsQuery } from '../services/api';
import PageHeader from '../components/common/PageHeader';

interface StatsCardProps {
    title: string;
    value: number;
    change: string;
    icon: React.ReactNode;
    bgColor: string;
    hoverColor: string;
    gradientFrom: string;
    gradientTo: string;
}

const StatsCard: React.FC<StatsCardProps> = ({
    title,
    value,
    change,
    icon,
    bgColor,
    hoverColor,
    gradientFrom,
    gradientTo,
}) => {
    return (
        <Card hover padding="md" className="dark:bg-gray-800 dark:border-gray-700 group">
            <div className="flex items-center">
                <div className="shrink-0">
                    <div className={`p-3 ${bgColor} dark:opacity-80 rounded-lg ${hoverColor} transition-colors`}>
                        {icon}
                    </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                    <dl>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                            {title}
                        </dt>
                        <dd className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                            <span
                                className={`bg-gradient-to-r ${gradientFrom} ${gradientTo} bg-clip-text text-transparent block truncate`}
                                title={value.toLocaleString()}
                            >
                                {value.toLocaleString()}
                            </span>
                        </dd>

                        <dd className="text-xs text-green-600 dark:text-green-400 font-medium mt-1">
                            {change} from last month
                        </dd>
                    </dl>
                </div>
            </div>
        </Card>
    );
};

const DashboardPage: React.FC = () => {
    const { isGuest } = useSelector((state: RootState) => state.auth);

    const { data: urlsData } = useGetUserUrlsQuery(
        { page: 1, pageSize: 20 },
        { skip: isGuest }
    );

    const stats = useMemo(() => {
        if (!urlsData?.data) {
            return {
                totalUrls: 0,
                totalClicks: 0,
                activeUrls: 0,
            };
        }

        const urls = urlsData.data.data;
        const totalUrls = urls.length;
        const totalClicks = urls.reduce((sum: number, url) => sum + (url.access_count || 0), 0);
        const activeUrls = urls.filter(url => !url.expires_at || new Date(url.expires_at) > new Date()).length;

        return { totalUrls, totalClicks, activeUrls };
    }, [urlsData]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 relative">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400 dark:bg-blue-600 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-xl opacity-20 animate-pulse" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400 dark:bg-purple-600 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-xl opacity-20 animate-pulse" />
            </div>

            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <PageHeader title='URL Dashboard' subtitle='Manage and monitor your shortened URLs' showBackButton />

                <URLShortenerForm />

                {!isGuest && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 animate-fade-in">
                        <StatsCard
                            title="Total URLs"
                            value={stats.totalUrls}
                            change="+12%"
                            icon={
                                <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                            }
                            bgColor="bg-blue-100"
                            hoverColor="group-hover:bg-blue-200"
                            gradientFrom="from-blue-600"
                            gradientTo="to-blue-800"
                        />

                        <StatsCard
                            title="Total Clicks"
                            value={stats.totalClicks}
                            change="+23%"
                            icon={
                                <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                            }
                            bgColor="bg-green-100"
                            hoverColor="group-hover:bg-green-200"
                            gradientFrom="from-green-600"
                            gradientTo="to-green-800"
                        />

                        <StatsCard
                            title="Active URLs"
                            value={stats.activeUrls}
                            change="+8%"
                            icon={
                                <svg className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            }
                            bgColor="bg-purple-100"
                            hoverColor="group-hover:bg-purple-200"
                            gradientFrom="from-purple-600"
                            gradientTo="to-purple-800"
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default DashboardPage;