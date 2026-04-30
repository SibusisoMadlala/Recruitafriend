import { Link } from 'react-router';
import { Linkedin, Facebook, Instagram, Twitter } from 'lucide-react';

export function Footer() {
  return (
    <footer className="mt-16 overflow-x-hidden bg-[var(--rf-navy)] text-white sm:mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Logo and Tagline */}
          <div className="col-span-1 md:col-span-2">
            <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-xl font-bold text-white sm:text-2xl">Recruit</span>
              <span className="text-xl font-bold text-[var(--rf-green)] sm:text-2xl">Friend</span>
            </div>
            <p className="text-gray-300 mb-4">Your Career. Our Mission.</p>
            <p className="text-sm text-gray-400">
              Connecting South African job seekers with top employers every day.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/jobs" className="text-gray-300 hover:text-[var(--rf-green)] transition-colors">Find Jobs</Link></li>
              <li><Link to="/employer/post-job" className="text-gray-300 hover:text-[var(--rf-green)] transition-colors">Post a Job</Link></li>
              <li><Link to="/seeker/network" className="text-gray-300 hover:text-[var(--rf-green)] transition-colors">Community</Link></li>
              <li><a href="#" className="text-gray-300 hover:text-[var(--rf-green)] transition-colors">Blog</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/terms" className="text-gray-300 hover:text-[var(--rf-green)] transition-colors">Terms &amp; Conditions</Link></li>
              <li><span className="text-gray-400">Privacy Policy</span></li>
            </ul>
          </div>

        </div>

        {/* Social and Bottom Bar */}
        <div className="mt-8 flex flex-col items-start justify-between gap-4 border-t border-gray-700 pt-8 md:flex-row md:items-center">
          <div className="flex flex-wrap items-center gap-4">
            <a href="#" className="text-gray-300 hover:text-[var(--rf-green)] transition-colors">
              <Linkedin className="w-5 h-5" />
            </a>
            <a href="#" className="text-gray-300 hover:text-[var(--rf-green)] transition-colors">
              <Facebook className="w-5 h-5" />
            </a>
            <a href="#" className="text-gray-300 hover:text-[var(--rf-green)] transition-colors">
              <Instagram className="w-5 h-5" />
            </a>
            <a href="#" className="text-gray-300 hover:text-[var(--rf-green)] transition-colors">
              <Twitter className="w-5 h-5" />
            </a>
          </div>
          
          <div className="text-center text-sm text-gray-400 md:text-right">
            <p className="mb-1">Proudly South African 🇿🇦 | POPIA Compliant</p>
            <p>
              © 2025 RecruitFriend. All rights reserved.{' '}
              <Link to="/terms" className="text-gray-300 transition-colors hover:text-[var(--rf-green)]">
                Terms &amp; Conditions
              </Link>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
