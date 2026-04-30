import React from 'react';
import { createBrowserRouter } from 'react-router';
import Root from './pages/Root';
import Homepage from './pages/Homepage';
import JobSearch from './pages/JobSearch';
import JobDetail from './pages/JobDetail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ProtectedRoute from './components/ProtectedRoute';
// Layouts
import SeekerLayout from './layouts/SeekerLayout';
import EmployerLayout from './layouts/EmployerLayout';
// Pages
import SeekerDashboard from './pages/SeekerDashboard';
import ProfileBuilder from './pages/ProfileBuilder';
import VideoInterviews from './pages/VideoInterviews';
import Networking from './pages/Networking';
import SeekerSubscriptions from './pages/SeekerSubscriptions';
import SeekerCV from './pages/SeekerCV';
import SeekerAlerts from './pages/SeekerAlerts';
import SeekerSavedJobs from './pages/SeekerSavedJobs';
import SeekerApplications from './pages/SeekerApplications';

import EmployerDashboard from './pages/EmployerDashboard';
import PostJob from './pages/PostJob';
import TalentSearch from './pages/TalentSearch';
import EmployerSubscriptions from './pages/EmployerSubscriptions';
import EmployerProfile from './pages/EmployerProfile';
import EmployerAnalytics from './pages/EmployerAnalytics';
import MyListings from './pages/MyListings';
import EmployerApplicants from './pages/EmployerApplicants';
import EmployerInterviews from './pages/EmployerInterviews';
import Login from './pages/Login';
import Signup from './pages/Signup';
import TermsAndConditions from './pages/TermsAndConditions';
import VerifyEmail from './pages/VerifyEmail';
import NotFound from './pages/NotFound';
import CommunityBlogs from './pages/CommunityBlogs';
import CommunityBlogDetail from './pages/CommunityBlogDetail';
import CommunityBlogSubmit from './pages/CommunityBlogSubmit';
import EmployerOnboardingStatus from './pages/EmployerOnboardingStatus';
import AdminLayout from './layouts/AdminLayout';
import AdminDashboard from './pages/AdminDashboard';
import AdminOnboardingQueue from './pages/AdminOnboardingQueue';
import AdminCommunityBlogs from './pages/AdminCommunityBlogs';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Root,
    children: [
      { index: true, Component: Homepage },
      { path: 'jobs', Component: JobSearch },
      { path: 'jobs/:id', Component: JobDetail },
      { path: 'community', Component: CommunityBlogs },
      { path: 'community/submit', element: <ProtectedRoute><CommunityBlogSubmit /></ProtectedRoute> },
      { path: 'community/:slug', Component: CommunityBlogDetail },
      { path: 'login', Component: Login },
      { path: 'signup', Component: Signup },
      { path: 'terms', Component: TermsAndConditions },
      { path: 'verify-email', Component: VerifyEmail },
      { path: 'forgot-password', Component: ForgotPassword },
      { path: 'reset-password', Component: ResetPassword },
    ],
  },
  
  // Job Seeker Routes (Independent Layout) — protected
  {
    path: '/seeker',
    element: <ProtectedRoute role="seeker"><SeekerLayout /></ProtectedRoute>,
    children: [
      { path: 'dashboard', Component: SeekerDashboard },
      { path: 'profile', Component: ProfileBuilder },
      { path: 'cv', Component: SeekerCV },
      { path: 'alerts', Component: SeekerAlerts },
      { path: 'saved', Component: SeekerSavedJobs },
      { path: 'applications', Component: SeekerApplications },
      { path: 'interviews', Component: VideoInterviews },
      { path: 'network', Component: Networking },
      { path: 'subscriptions', Component: SeekerSubscriptions },
    ]
  },
  
  // Employer Routes (Independent Layout) — protected
  {
    path: '/employer/onboarding-status',
    element: <ProtectedRoute role="employer"><EmployerOnboardingStatus /></ProtectedRoute>,
  },
  {
    path: '/employer',
    element: <ProtectedRoute role="employer" requireApprovedEmployer><EmployerLayout /></ProtectedRoute>,
    children: [
        { path: 'dashboard', Component: EmployerDashboard },
        { path: 'profile', Component: EmployerProfile },
        { path: 'post-job', Component: PostJob },
        { path: 'listings', Component: MyListings },
        { path: 'applicants', Component: EmployerApplicants },
        { path: 'talent-search', Component: TalentSearch },
        { path: 'interviews', Component: EmployerInterviews },
        { path: 'analytics', Component: EmployerAnalytics },
        { path: 'subscriptions', Component: EmployerSubscriptions },
        { path: 'applicants/:jobId', Component: EmployerApplicants },
    ]
  },

  // Admin routes
  {
    path: '/admin',
    element: <ProtectedRoute role="admin"><AdminLayout /></ProtectedRoute>,
    children: [
      { path: 'dashboard', Component: AdminDashboard },
      { path: 'onboarding', Component: AdminOnboardingQueue },
      { path: 'community/blogs', Component: AdminCommunityBlogs },
    ],
  },
  
  { path: '*', Component: NotFound },
]);
