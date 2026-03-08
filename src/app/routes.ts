import { createBrowserRouter } from 'react-router';
import Root from './pages/Root';
import Homepage from './pages/Homepage';
import JobSearch from './pages/JobSearch';
import JobDetail from './pages/JobDetail';
import SeekerDashboard from './pages/SeekerDashboard';
import ProfileBuilder from './pages/ProfileBuilder';
import VideoInterviews from './pages/VideoInterviews';
import Networking from './pages/Networking';
import SeekerSubscriptions from './pages/SeekerSubscriptions';
import EmployerDashboard from './pages/EmployerDashboard';
import PostJob from './pages/PostJob';
import TalentSearch from './pages/TalentSearch';
import EmployerSubscriptions from './pages/EmployerSubscriptions';
import ApplicantTracking from './pages/ApplicantTracking';
import Login from './pages/Login';
import Signup from './pages/Signup';
import NotFound from './pages/NotFound';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Root,
    children: [
      { index: true, Component: Homepage },
      { path: 'jobs', Component: JobSearch },
      { path: 'jobs/:id', Component: JobDetail },
      { path: 'login', Component: Login },
      { path: 'signup', Component: Signup },
      
      // Job Seeker Routes
      { path: 'seeker/dashboard', Component: SeekerDashboard },
      { path: 'seeker/profile', Component: ProfileBuilder },
      { path: 'seeker/interviews', Component: VideoInterviews },
      { path: 'seeker/network', Component: Networking },
      { path: 'seeker/subscriptions', Component: SeekerSubscriptions },
      
      // Employer Routes
      { path: 'employer/dashboard', Component: EmployerDashboard },
      { path: 'employer/post-job', Component: PostJob },
      { path: 'employer/talent-search', Component: TalentSearch },
      { path: 'employer/subscriptions', Component: EmployerSubscriptions },
      { path: 'employer/applicants/:jobId', Component: ApplicantTracking },
      
      { path: '*', Component: NotFound },
    ],
  },
]);
