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
import { Dispatch, Fragment, SetStateAction, useEffect, useMemo, useState } from "react"
import { TimeSeriesData } from "@/app/page"
import { Dialog, Transition } from "@headlessui/react"
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
            .limit(100)
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
    const [threshold, setThreshold] = useState(100)
    const [dataState, setDataState] = useState<TimeSeriesData[]>(data)
    const [realtimeEnabled, setRealtimeEnabled] = useState(false)
    const [showPasswordModal, setShowPasswordModal] = useState(false)
    const [password, setPassword] = useState("")
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
        if (!realtimeEnabled) return
        
        fetchData(setRefreshing, setDataState, setLastRefreshed)
        
        const interval = setInterval(() => {
            fetchData(setRefreshing, setDataState, setLastRefreshed)
        }, 5000)
        
        return () => clearInterval(interval)
    }, [realtimeEnabled])

    return (
        <Fragment>
        <Transition appear show={showPasswordModal} as={Fragment}>
            <Dialog as="div" className="relative z-10" onClose={() => setShowPasswordModal(false)}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black bg-opacity-25" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-sm transform overflow-hidden rounded bg-white p-6 text-left align-middle shadow-xl transition-all">
                                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                                    Enter Realtime Password
                                </Dialog.Title>
                                <div className="mt-2">
                                    <input
                                        type="password"
                                        className="w-full border rounded px-3 py-2"
                                        placeholder="Password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)} />
                                </div>

                                <div className="mt-4 flex justify-end gap-2">
                                    <button
                                        onClick={() => setShowPasswordModal(false)}
                                        className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (password === atob("YmFqZXI=")) {
                                                setRealtimeEnabled(true)
                                                setShowPasswordModal(false)
                                            } else {
                                                alert("Incorrect password")
                                            }
                                        } }
                                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded"
                                    >
                                        Confirm
                                    </button>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
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
                    <button
                        onClick={() => {
                            if (realtimeEnabled) {
                                setRealtimeEnabled(false)
                            } else {
                                setShowPasswordModal(true)
                            }
                        } }
                        className={`px-4 py-2 font-medium rounded text-white ${realtimeEnabled ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"}`}
                    >
                        {realtimeEnabled ? "Disable Realtime" : "Enable Realtime"}
                    </button>
                </div>

                {realtimeEnabled && (
                    <div className="mb-4 flex items-center gap-3">
                        <span className="inline-flex items-center bg-green-100 text-green-800 text-sm font-medium px-3 py-1 rounded-full">
                        🔄 Realtime Mode Enabled
                        </span>
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
                )}

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
        </Fragment>
    )
}
