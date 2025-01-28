// app/candidate/dashboard/saved/page.tsx
import { Suspense } from "react"
import { getSavedJobs } from "@/app/actions/jobs"
import { SavedJobsClient } from "@/app/candidate/dashboard/saved/saved-jobs-client"
import SavedJobsLoading from "./loading" // Change to default import

export default async function SavedJobsPage() {
  const savedJobs = await getSavedJobs()
  console.log(savedJobs)

  return (
    <Suspense fallback={<SavedJobsLoading />}>
      <SavedJobsClient initialJobs={savedJobs} />
    </Suspense>
  )
}