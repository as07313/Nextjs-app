import { NextApiRequest, NextApiResponse } from 'next';
import connectToDatabase from '@/lib/mongodb';
import jwt from 'jsonwebtoken'
import { Candidate } from '@/models/User';
import { Job } from '@/models/Job';
import { Apiauth } from '@/app/middleware/auth'

const handler = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
  try {
    await connectToDatabase();

    // const user = Apiauth(req, res);
    // console.log("user", user)
    
    // if (!user) {
    //   return res.status(401).json({error: "User not found"})
    // }

    
    const token = req.headers.authorization?.split(' ')[1];
    //console.log(token);
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    const userId = decoded.userId;
    console.log("user\n",userId)


    switch (req.method) {

      case 'POST':
        console.log("req query", req.query);
        console.log("Req body", req.body);
        const { jobId } = req.body;
        console.log(jobId)
        if (!jobId) {
          return res.status(401).json({ error: 'Job ID is required' });
        }
       
        await Candidate.findByIdAndUpdate(userId, {
          $addToSet: { savedJobs: jobId }
        });
        return res.status(200).json({ success: true, message: 'Job saved successfully' });

      case 'DELETE':
        const { jobId: jobToRemove } = req.query;
        if (!jobToRemove) {
          return res.status(400).json({ error: 'Job ID is required' });
        }
        await Candidate.findByIdAndUpdate(userId, {
          $pull: { savedJobs: jobToRemove }
        });
        return res.status(200).json({ success: true, message: 'Job removed from saved' });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error managing saved jobs:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export default handler;
