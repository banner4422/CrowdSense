import TimeSeriesClient from "@/components/TimeSeriesClient"
import { supabase } from "@/utils/supabase"

export interface TimeSeriesData {
  id: string
  created_at: string
  people_count: number
}

export default async function TimeSeriesPage() {
  const { data, error } = await supabase
    .from<string, TimeSeriesData>("people_counter")
    .select("id, created_at, people_count")
    .order("created_at", { ascending: true })
    .limit(100)

  if (error) {
    console.error("Supabase error:", error)
    return <p className="text-red-500">Failed to load data.</p>
  }

  return <TimeSeriesClient data={data ?? []} />
}
