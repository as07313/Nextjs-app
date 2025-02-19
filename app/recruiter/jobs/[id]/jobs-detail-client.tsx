// app/recruiter/jobs/[id]/jobs-detail-client.tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Users, MapPin, DollarSign, Building2, Calendar } from "lucide-react"
import { JobDetails } from "@/components/recruiter/jobs/job-details"
import { JobApplicants } from "@/components/recruiter/jobs/job-applicants"
import { JobInsights } from "@/components/recruiter/jobs/job-insights"

interface Job {
  id: string
  title: string
  department: string
  location: string
  type: string
  status: string
  applicants: number
  postedDate: string
  salary: string
  description: string
  requirements: string[]
  benefits: string[]
}

interface JobApplicant {
  id: string
  name: string
  email: string
  avatar: string
  phone: string
  skills: string[]
  experience: string
  stage: 'new' | 'screening' | 'shortlist' | 'interview' | 'offer' | 'hired' | 'rejected'
  jobFitScore: number
  appliedDate: string
  location: string
  currentRole?: string
  company?: string
  interviews?: Array<{
    scheduledDate: Date
    type: 'technical' | 'hr' | 'cultural' | 'final'
    status: 'scheduled' | 'completed' | 'cancelled'
    feedback?: string
  }>
}

interface JobDetailsClientProps {
  job: Job
  applicants: JobApplicant[]
}

export function JobDetailsClient({ job, applicants }: JobDetailsClientProps) {
  const [activeTab, setActiveTab] = useState("details")

  return (
    <div className="container max-w-7xl py-8">
      {/* Header section */}
      <div className="mb-6">
        <Link
          href="/recruiter/jobs"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Jobs
        </Link>

        {/* Rest of your UI */}
        <Card className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="details">Job Details</TabsTrigger>
              <TabsTrigger value="applicants">Applicants</TabsTrigger>
              {/* <TabsTrigger value="insights">Insights</TabsTrigger> */}
            </TabsList>

            <div className="mt-6">
              <TabsContent value="details">
                <JobDetails job={job} />
              </TabsContent>

              <TabsContent value="applicants">
              <JobApplicants
              jobId={job.id}
              initialApplicants={applicants}
              />
              </TabsContent>

              {/* <TabsContent value="insights">
                <JobInsights jobId={job.id} />
              </TabsContent> */}
            </div>
          </Tabs>
        </Card>
      </div>
    </div>
  )
}