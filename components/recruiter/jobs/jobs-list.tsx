"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Users, Calendar, MapPin, DollarSign, BarChart } from "lucide-react"
import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Job } from "@/app/recruiter/jobs/jobs-client" // Import Job type from your client file

interface JobsListProps {
  jobs: Job[];
  searchQuery: string;
  statusFilter: string;
  viewType: string;
}

// Type for matched candidates
interface MatchedCandidate {
  candidate_id: string;
  total_score: number;
  technical_score: number;
  experience_score: number;
  education_score: number;
  soft_skills_score: number;
  analysis: string;
  strengths: string[];
  improvements: string[];
}

// Type for candidate lookup map
interface CandidateMap {
  [jobId: string]: {
    candidates: MatchedCandidate[];
  };
}

const statusStyles = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-yellow-100 text-yellow-800",
  closed: "bg-red-100 text-red-800",
  draft: "bg-gray-100 text-gray-800"
}

export function JobsList({ jobs, searchQuery, statusFilter, viewType }: JobsListProps) {
  const router = useRouter()
  const [matchedCandidates, setMatchedCandidates] = useState<CandidateMap>({})
  const [selectedCandidate, setSelectedCandidate] = useState<MatchedCandidate | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loadingJobs, setLoadingJobs] = useState<{ [key: string]: boolean }>({})
  
  // Filter jobs on the client side
  const filteredJobs = jobs.filter((job) => {
    const matchesSearch = job.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || job.status === statusFilter
    return matchesSearch && matchesStatus
  })

  async function matchJD(description: string, jobId: string) {
    setLoadingJobs(prev => ({ ...prev, [jobId]: true }))
    try {
      const response = await fetch("https://hirehub-api-795712866295.europe-west4.run.app/api/match-job-description", {
        method: "POST",
        body: JSON.stringify({ description }),
        headers: {
          "Content-Type": "application/json"
        }
      })
      const data = await response.json()
      setMatchedCandidates(prev => ({ ...prev, [jobId]: data }))
    } catch (error) {
      console.error("Error fetching matched candidates:", error)
    } finally {
      setLoadingJobs(prev => ({ ...prev, [jobId]: false }))
    }
  }

  // Function to open the modal with candidate details
  const openCandidateModal = (candidate: MatchedCandidate) => {
    setSelectedCandidate(candidate)
    setIsModalOpen(true)
  }

  return (
    <div className={viewType === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-4'}>
      {filteredJobs.map((job) => (
        <Card key={job.id} className="p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-semibold">{job.title}</h3>
                  <Badge 
                    variant="secondary"
                    className={statusStyles[job.status as keyof typeof statusStyles]}
                  >
                    {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {job.location}
                  </span>
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    ${job.salary.min}-{job.salary.max}/year
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Posted {job.postedDate ? new Date(job.postedDate).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium">Total Applicants</p>
                    <p className="text-2xl font-semibold">{job.applicantStats.total}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
            <Button 
                variant="default"
                className="w-full lg:w-auto"
                onClick={() => router.push(`/recruiter/jobs/${job.id}`)}
              >
                View Details
              </Button>
            </div>
          </div>

          {loadingJobs[job.id] && (
            <div className="mt-6 space-y-4">
              <Skeleton className="h-8 w-1/2" />
              <div className="space-y-2">
                {[1, 2, 3].map((_, index) => (
                  <Skeleton key={index} className="h-12 w-full" />
                ))}
              </div>
            </div>
          )}

          {matchedCandidates[job.id] && !loadingJobs[job.id] && (
            <div className="mt-6">
              <h4 className="text-lg font-semibold mb-4">Matched Candidates</h4>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Candidate ID</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Score</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Technical Score</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Experience Score</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Education Score</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Soft Skills Score</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {matchedCandidates[job.id].candidates.map((candidate) => (
                    <tr key={candidate.candidate_id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{candidate.candidate_id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{candidate.total_score}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{candidate.technical_score}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{candidate.experience_score}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{candidate.education_score}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{candidate.soft_skills_score}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openCandidateModal(candidate)}
                        >
                          View Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ))}

      {/* Modal for displaying candidate details */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Candidate Details</DialogTitle>
            <DialogDescription>
              Detailed analysis of the candidate's strengths and areas for improvement.
            </DialogDescription>
          </DialogHeader>
          {selectedCandidate && (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold">Analysis</h4>
                <p className="text-sm text-muted-foreground">{selectedCandidate.analysis}</p>
              </div>
              <div>
                <h4 className="font-semibold">Strengths</h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground">
                  {selectedCandidate.strengths.map((strength, index) => (
                    <li key={index}>{strength}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold">Improvements</h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground">
                  {selectedCandidate.improvements.map((improvement, index) => (
                    <li key={index}>{improvement}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}