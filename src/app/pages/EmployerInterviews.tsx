import { useState } from 'react';
import { 
  Calendar as CalendarIcon, Clock, Video,  MoreHorizontal, 
  CheckCircle2, XCircle, User, PlayCircle, MessageSquare, AlertCircle
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';

export default function EmployerInterviews() {
  const [activeTab, setActiveTab] = useState('upcoming');

  const upcomingInterviews: any[] = [];
  const pastInterviews: any[] = [];
  const requests: any[] = [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0A2540]">Video Interviews</h1>
          <p className="text-gray-500">Manage and schedule your candidate interviews</p>
        </div>
        <Button className="bg-[#00C853] hover:bg-[#00B548] text-white">
          <CalendarIcon className="mr-2 h-4 w-4" /> Schedule Interview
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-blue-50 border-blue-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium text-[#0A2540] flex items-center gap-2">
              <Video className="h-5 w-5 text-blue-500" /> Upcoming
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#0A2540]">0</div>
            <p className="text-sm text-gray-500">Interviews this week</p>
          </CardContent>
        </Card>
        
        <Card className="bg-green-50 border-green-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium text-[#0A2540] flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-[#00C853]" /> Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#0A2540]">0</div>
            <p className="text-sm text-gray-500">Interviews this month</p>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-100">
           <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium text-[#0A2540] flex items-center gap-2">
                 <Clock className="h-5 w-5 text-purple-500" /> Average Duration
              </CardTitle>
           </CardHeader>
           <CardContent>
              <div className="text-3xl font-bold text-[#0A2540]">0m</div>
              <p className="text-sm text-gray-500">Per interview session</p>
           </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="upcoming" className="w-full" onValueChange={setActiveTab}>
        <div className="flex justify-between items-center mb-4">
           <TabsList>
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="past">Past / Recorded</TabsTrigger>
              <TabsTrigger value="requests">Requests (0)</TabsTrigger>
           </TabsList>
        </div>

        <TabsContent value="upcoming" className="space-y-4">
           {upcomingInterviews.length > 0 ? (
              upcomingInterviews.map((interview) => (
              <Card key={interview.id} className="hover:shadow-md transition-shadow">
                 <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-6">
                    {/* Content */}
                 </CardContent>
              </Card>
           ))
           ) : (
              <div className="flex flex-col items-center justify-center bg-gray-50 rounded-xl border-dashed border-2 border-gray-200 p-12">
                 <CalendarIcon className="w-12 h-12 text-gray-300 mb-4" />
                 <h3 className="text-lg font-bold text-[#0A2540]">No Upcoming Interviews</h3>
                 <p className="text-gray-500 text-sm mb-4">Schedule your first interview with a candidate.</p>
                 <Button variant="outline" className="border-gray-300">Schedule Now</Button>
              </div>
           )}
        </TabsContent>

        <TabsContent value="past" className="space-y-4">
           {pastInterviews.length > 0 ? (
              pastInterviews.map((interview) => (
              <Card key={interview.id}>
                 <CardContent>
                    {/* Content */}
                 </CardContent>
              </Card>
           ))
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center">
               <p className="text-gray-500">No past interviews to show.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="requests">
           <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 bg-gray-50 rounded-lg dashed border-2 border-gray-200">
              <div className="bg-white p-4 rounded-full shadow-sm">
                 <AlertCircle className="w-8 h-8 text-gray-400" />
              </div>
              <div>
                 <h3 className="font-bold text-[#0A2540] text-lg">No Pending Requests</h3>
                 <p className="text-gray-500 max-w-md mx-auto">You have no interview requests from candidates at this time.</p>
              </div>
           </div>
        </TabsContent>
      </Tabs>
      
    </div>
  );
}
