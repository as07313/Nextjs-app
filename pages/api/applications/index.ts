import type { NextApiRequest, NextApiResponse } from 'next';
import connectToDatabase from '@/lib/mongodb';
import { Applicant } from '@/models/Applicant';
import { Job } from '@/models/Job';
import { Apiauth }  from '@/app/middleware/auth'


// pages/api/applications/index.ts
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        await connectToDatabase();

        switch (req.method) {
            case 'POST':
                // const user = await Apiauth(req, res);
                // if (!user) {
                //     return res.status(401).json({error: 'User not found'});
                // }

                const { jobId, resumeId, coverLetter } = req.body;

                // Validate job exists and has applicants array
                const job = await Job.findById(jobId);
                if (!job) {
                    return res.status(404).json({error: 'Job not found'});
                }

                
                // Check for existing application
                const existing = await Applicant.findOne({
                    candidateId: user.userId,
                    jobId
                });

                if (existing) {
                    return res.status(400).json({error: 'Already applied'});
                }

                // Create application
                const application = await Applicant.create({
                    candidateId: user.userId,
                    jobId,
                    resumeId,
                    coverLetter,
                    status: 'new',
                    appliedDate: new Date(),
                    jobFitScore: 0
                });

                // Update job with new applicant
                await Job.findByIdAndUpdate(
                    jobId,
                    { $addToSet: { applicants: user.userId } },
                    { new: true, runValidators: true }
                );

                return res.status(201).json(application);

            default:
                return res.status(405).json({error: 'Method not allowed'});    
        }
    } catch(error) {
        console.error('Application error:', error);
        return res.status(500).json({error: 'Internal Server Error'});
    }
}