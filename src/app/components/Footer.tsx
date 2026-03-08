import { Link } from 'react-router';
import { Linkedin, Facebook, Instagram, Twitter } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-[var(--rf-navy)] text-white mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo and Tagline */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <span className="text-2xl font-bold text-white">Recruit</span>
              <span className="text-2xl font-bold text-[var(--rf-green)]">Friend</span>
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

          {/* Company */}
          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="text-gray-300 hover:text-[var(--rf-green)] transition-colors">About Us</a></li>
              <li><a href="#" className="text-gray-300 hover:text-[var(--rf-green)] transition-colors">How It Works</a></li>
              <li><a href="#" className="text-gray-300 hover:text-[var(--rf-green)] transition-colors">Pricing</a></li>
              <li><a href="#" className="text-gray-300 hover:text-[var(--rf-green)] transition-colors">Contact</a></li>
              <li><a href="#" className="text-gray-300 hover:text-[var(--rf-green)] transition-colors">FAQ</a></li>
            </ul>
          </div>
        </div>

        {/* Social and Bottom Bar */}
        <div className="border-t border-gray-700 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-4 mb-4 md:mb-0">
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
          
          <div className="text-sm text-gray-400 text-center md:text-right">
            <p className="mb-1">Proudly South African 🇿🇦 | POPIA Compliant</p>
            <p>© 2025 RecruitFriend. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
