"use client"

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
} from "recharts"
import { DateTime } from "luxon"
import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react"
import { TimeSeriesData } from "@/app/page"
import { supabase } from "@/utils/supabase"

const exportDataToCsv = (chartData: { id: string; time: string; value: number; timestamp: Date }[]) => () => {
    const header = ["People Count", "Timestamp (ISO)"]
    const rows = chartData.map((row) => [row.value, row.timestamp.toISOString()])
    const csv = [header, ...rows]
        .map((r) => r.map((cell) => `"${cell}"`).join(","))
        .join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `people_counter_export_${DateTime.now().toISODate()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
}

const fetchData = (setRefreshing: Dispatch<SetStateAction<boolean>>, setDataState: Dispatch<SetStateAction<TimeSeriesData[]>>, setLastRefreshed: Dispatch<SetStateAction<Date | null>>) => {
    return async () => {
        setRefreshing(true)
        const { data, error } = await supabase
            .from<string, TimeSeriesData>("people_counter")
            .select("id, created_at, people_count")
            .order("created_at", { ascending: true })
        if (error) {
            console.error("Supabase fetch error:", error)
        } else {
            setDataState(data ?? [])
            setLastRefreshed(new Date())
        }
        setRefreshing(false)
    }
}

interface ChartData {
    id: string
    time: string
    value: number
    timestamp: Date
}

interface TimeSeriesClientProps {
    data: TimeSeriesData[]
}

export default function TimeSeriesClient({ data }: TimeSeriesClientProps) {
    const [threshold, setThreshold] = useState(10)
    const [dataState, setDataState] = useState<TimeSeriesData[]>(data)
    const [refreshing, setRefreshing] = useState(false)
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

    const chartData = useMemo(() => dataState.map<ChartData>((d) => {
        const dt = DateTime.fromISO(d.created_at)
        return {
            id: d.id,
            time: dt.toFormat("HH:mm:ss"),
            value: d.people_count,
            timestamp: dt.toJSDate(),
        }
    }), [dataState])
    const tableData = useMemo(() => 
        [...chartData].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
    [chartData])

    const isThresholdExceeded = useMemo(() => 
        chartData.some((point) => point.value > threshold),
    [chartData, threshold])
    const latestValue = useMemo(() => 
        chartData.at(-1)?.value ?? "N/A",
    [chartData])

    useEffect(() => {
        const fetch = fetchData(setRefreshing, setDataState, setLastRefreshed)
        fetch()
        const interval = setInterval(() => {
        fetch()
        }, 5000)
        return () => clearInterval(interval)
    }, [])

    return (
        <div className="container mx-auto px-4 py-8">
            {isThresholdExceeded && (
                <div className="fixed top-10 right-10 z-50 bg-red-600 text-white px-4 py-2 rounded shadow-lg animate-pulse">
                    🚨 People count exceeded the limit of {threshold}!
                </div>
            )}
            {/* Header */}
            <h1 className="text-2xl font-bold mb-6">CrowdSense</h1>
            <h2 className="text-lg font-semibold mb-4">People Counter - {DateTime.now().toFormat("DDDD")}</h2>
            <div className="mb-6 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                    <label className="font-medium text-gray-700">Alert Threshold:</label>
                    <input
                        type="number"
                        className="border rounded px-2 py-1 w-24"
                        value={threshold}
                        min={0}
                        max={100}
                        onChange={(e) => setThreshold(Number(e.target.value))} />
                </div>
                <button
                    onClick={exportDataToCsv(chartData)}
                    className="bg-blue-500 hover:bg-blue-600 text-white font-medium px-4 py-2 rounded cursor-pointer"
                >
                    Export to CSV
                </button>
            </div>
            <div className="mb-4 flex items-center gap-3">
                {refreshing ? (
                    <span className="text-sm text-gray-500 flex items-center gap-1">
                    <span className="h-3 w-3 animate-spin border-2 border-t-transparent border-blue-500 rounded-full" />
                    Refreshing...
                    </span>
                ) : (
                    lastRefreshed && (
                    <span className="text-sm text-gray-500">
                        Last refreshed at {DateTime.fromJSDate(lastRefreshed).toFormat("HH:mm:ss")}
                    </span>
                    )
                )}
            </div>

            {/* Graph */}
            <div className="bg-white p-4 rounded-lg shadow-md mb-8">
                <h1 className="text-lg font-semibold mb-4">Time Series Graph</h1>
                <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                                dataKey="time"
                                label={{ value: "Time", position: "insideBottomRight", offset: -10 }} />
                            <YAxis
                                domain={[0, 15]} // Y-axis top value set to 200
                                label={{ value: "People", angle: -90, position: "insideLeft" }} />
                            <Tooltip
                                formatter={(value) => [`${value}`, "People"]}
                                labelFormatter={(label) => `Time: ${label}`} />
                            <ReferenceLine
                                y={threshold}
                                stroke="red"
                                strokeDasharray="3 3"
                                label={{ value: `Limit (${threshold})`, position: "top", fill: "red" }} />
                            <Line
                                type="monotone"
                                dataKey="value"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                dot={{ r: 4 }}
                                activeDot={{ r: 6 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="mb-8">
                <div className="inline-block bg-blue-100 border border-blue-300 text-blue-800 text-sm font-semibold px-4 py-2 rounded shadow-sm">
                    Latest People Count: <span className="text-blue-900 text-lg font-bold">{latestValue}</span>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white p-4 rounded-lg shadow-md">
                <h2 className="text-lg font-semibold mb-4">Recent Entries</h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time (HH:mm:ss)</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">People</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Relative time Ago</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {tableData.map((row) => (
                                <tr key={row.id}>
                                    <td className="px-6 py-4 text-sm text-gray-500">{row.time}</td>
                                    <td className="px-6 py-4 text-sm text-gray-900">{row.value}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {DateTime.fromJSDate(row.timestamp).toRelative()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
