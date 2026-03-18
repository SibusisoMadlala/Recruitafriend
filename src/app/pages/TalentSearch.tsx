import { useState } from 'react';
import { 
  Building2, MapPin, Globe, Upload, CheckCircle, 
  Linkedin, Facebook, Instagram, Twitter, Bell, Shield, Wallet, Users, Layout, Mail, Link as LinkIcon, Filter, MoreHorizontal,
  Search, Video, Calendar
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Card, CardContent } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';

export default function TalentSearch() {
   // STARTER plan limitation simulation
   const [isLocked, setIsLocked] = useState(true);

   // Empty candidates array
   const candidates: any[] = [];

   return (
     <div className="space-y-6 h-full flex flex-col relative overflow-hidden">
        
        {/* Upgrade Overlay if Locked */}
        {isLocked && (
           <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-center p-8">
              <div className="bg-white p-6 rounded-2xl shadow-xl max-w-md w-full border border-gray-100 ring-1 ring-black/5 animate-in fade-in zoom-in duration-500">
                 <div className="bg-green-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-[#00C853]">
                    <Search className="w-8 h-8" />
                 </div>
                 <h2 className="text-2xl font-bold text-[#0A2540] mb-2">Unlock Talent Search</h2>
                 <p className="text-gray-500 mb-6 px-4">
                    Upgrade to our <strong className="text-[#00C853]">Growth Plan</strong> to search our database of 48,000+ candidates and invite them to apply.
                 </p>
                 <ul className="text-left space-y-3 mb-8 bg-gray-50 p-4 rounded-lg text-sm text-gray-600">
                    <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#00C853]" /> Access full CV database</li>
                    <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#00C853]" /> Filter by skills & experience</li>
                    <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#00C853]" /> Watch video introductions</li>
                 </ul>
                 <div className="space-y-3">
                    <Button className="w-full bg-[#00C853] hover:bg-[#00B548] text-white shadow-lg shadow-green-500/20 py-6 text-lg">
                       Upgrade to Unlock
                    </Button>
                    <button onClick={() => setIsLocked(false)} className="text-sm text-gray-400 hover:text-gray-600 underline">
                       Preview (Demo Mode)
                    </button>
                 </div>
              </div>
           </div>
        )}

        {/* Header */}
        <div className="bg-[#0A2540] text-white p-8 rounded-xl relative overflow-hidden shadow-lg">
           <div className="relative z-10 max-w-3xl">
              <h1 className="text-3xl font-bold mb-2">Search Candidate Database</h1>
              <p className="text-blue-200 mb-6">Find the perfect talent from 48,000+ verified job seekers.</p>
              
              <div className="flex gap-2">
                 <div className="relative flex-1">
                    <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                    <Input 
                      placeholder="Search by skills, job title, qualifications..." 
                      className="pl-12 h-12 bg-white text-[#0A2540] border-none focus:ring-2 focus:ring-[#00C853]"
                    />
                 </div>
                 <Button className="h-12 px-8 bg-[#00C853] hover:bg-[#00B548] text-white font-bold text-base shadow-lg shadow-green-900/20">
                    Search
                 </Button>
              </div>
           </div>
           
           {/* Background Pattern */}
           <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 bg-gradient-to-l from-white to-transparent pointer-events-none"></div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 min-h-[500px]">
           
           {/* Filters Sidebar */}
           <div className="w-full lg:w-72 space-y-6 flex-shrink-0 bg-white p-6 rounded-xl border border-gray-100 h-fit sticky top-6 shadow-sm">
              <div className="flex items-center justify-between">
                 <h3 className="font-bold text-[#0A2540]">Filters</h3>
                 <button className="text-xs text-gray-500 hover:text-[#0A2540]">Clear All</button>
              </div>
              
              <div className="space-y-4">
                 <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Location</label>
                    <Input placeholder="City or Province" />
                 </div>
                 
                 <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Experience Level</label>
                    <div className="space-y-2">
                       {['Entry Level', 'Junior (1-2y)', 'Mid-Level (3-5y)', 'Senior (5+y)'].map(level => (
                          <div key={level} className="flex items-center space-x-2">
                             <Checkbox id={level} />
                             <label htmlFor={level} className="text-sm text-gray-600">{level}</label>
                          </div>
                       ))}
                    </div>
                 </div>

                 <div className="space-y-2">
                    <div className="flex items-center justify-between">
                       <label className="text-sm font-medium text-gray-700">Has Video Intro</label>
                       <Checkbox />
                    </div>
                 </div>

                 <Button className="w-full bg-[#0A2540] text-white hover:bg-[#081f36]">Apply Filters</Button>
              </div>
           </div>

           {/* Results Grid */}
           <div className="flex-1 space-y-4">
              <div className="flex justify-between items-center text-sm text-gray-500">
                 <span>Showing 0 of 0 candidates</span>
                 <select className="bg-transparent border-none outline-none font-medium text-[#0A2540] cursor-pointer hover:bg-gray-50 rounded px-2 py-1">
                    <option>Sort by: Relevance</option>
                    <option>Newest First</option>
                 </select>
              </div>

              {candidates.length > 0 ? (
                 candidates.map(candidate => (
                 <Card key={candidate.id} className="border-none shadow-sm hover:shadow-md transition-all hover:border-gray-200 group">
                    <CardContent className="p-6">
                       {/* Card Content would go here */}
                    </CardContent>
                 </Card>
                 ))
               ) : (
                  <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border-dashed border-2 border-gray-100">
                      <div className="bg-gray-50 p-4 rounded-full mb-4">
                         <Search className="w-8 h-8 text-gray-300" />
                      </div>
                      <h3 className="font-bold text-[#0A2540] text-lg mb-1">No candidates found</h3>
                      <p className="text-gray-500 text-sm">Try using different search terms or clearing filters.</p>
                  </div>
               )}
              
           </div>
        </div>
     </div>
   );
}
