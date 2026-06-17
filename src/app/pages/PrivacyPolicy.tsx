import { Link } from 'react-router';

const sections = [
  {
    title: '1. Who We Are',
    body: [
      'RecruitFriend is a South African online recruitment platform that connects job seekers with employers.',
      'Our registered address is in South Africa. You can contact us at admin@recruitfriend.co.za.',
    ],
  },
  {
    title: '2. Information We Collect',
    body: [
      'Job Seekers: name, email address, phone number, CV, work history, qualifications, and any other information you add to your profile.',
      'Employers: company name, contact person, email address, billing information, and job listings.',
      'All Users: login credentials, device information, browser type, IP address, and usage data collected automatically when you use the platform.',
    ],
  },
  {
    title: '3. How We Use Your Information',
    body: [
      'To create and manage your account.',
      'To match job seekers with relevant job listings and to share your CV with employers you apply to.',
      'To process job postings and payments from employers.',
      'To send you email notifications about applications, alerts, and platform updates.',
      'To improve the platform through anonymised analytics.',
      'To comply with legal obligations under South African law, including POPIA.',
    ],
  },
  {
    title: '4. Sharing Your Information',
    body: [
      'We share your CV and profile with employers only when you choose to apply for a job.',
      'We do not sell your personal information to any third party.',
      'We may share data with trusted service providers (e.g. email delivery, cloud hosting) who are bound by confidentiality agreements.',
      'We may disclose information if required by law or a valid court order.',
    ],
  },
  {
    title: '5. Data Storage & Security',
    body: [
      'Your data is stored securely on Supabase infrastructure hosted within the European Union (EU) region.',
      'We use industry-standard encryption (TLS/HTTPS) for data in transit.',
      'Access to personal data is restricted to authorised personnel only.',
      'While we take reasonable precautions, no system is 100% secure and we cannot guarantee absolute security.',
    ],
  },
  {
    title: '6. Cookies & Tracking',
    body: [
      'We use essential cookies required to keep you logged in and the platform functioning correctly.',
      'We do not use advertising or third-party tracking cookies.',
      'You can disable cookies in your browser settings, but this may affect platform functionality.',
    ],
  },
  {
    title: '7. Your Rights Under POPIA',
    body: [
      'You have the right to access the personal information we hold about you.',
      'You have the right to request correction of inaccurate information.',
      'You have the right to request deletion of your account and associated data.',
      'You have the right to object to processing of your information in certain circumstances.',
      'To exercise any of these rights, email us at admin@recruitfriend.co.za.',
    ],
  },
  {
    title: '8. Retention of Data',
    body: [
      'We retain your personal information for as long as your account is active.',
      'If you delete your account, we will remove your personal data within 30 days, except where we are required by law to retain it.',
    ],
  },
  {
    title: '9. Children\'s Privacy',
    body: [
      'RecruitFriend is not intended for use by persons under the age of 18.',
      'We do not knowingly collect personal information from minors. If you believe a minor has registered, please contact us immediately.',
    ],
  },
  {
    title: '10. Changes to This Policy',
    body: [
      'We may update this Privacy Policy from time to time. When we do, we will update the "Last Updated" date at the top of this page.',
      'Continued use of the platform after changes are published constitutes acceptance of the updated policy.',
    ],
  },
  {
    title: '11. Contact Us',
    body: [
      'If you have any questions about this Privacy Policy or how we handle your data, please contact us at admin@recruitfriend.co.za.',
    ],
  },
];

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <div className="max-w-3xl mx-auto px-4 py-12 sm:py-16">

        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-[#0A2540] mb-3">Privacy Policy</h1>
          <p className="text-sm text-gray-400">Last Updated: 17 June 2026</p>
          <p className="mt-4 text-gray-600 leading-relaxed">
            At RecruitFriend, your privacy matters. This policy explains what personal information we collect,
            how we use it, and what rights you have — in line with the <strong>Protection of Personal Information Act (POPIA)</strong> of South Africa.
          </p>
        </div>

        <div className="space-y-8">
          {sections.map((section) => (
            <div key={section.title} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-base font-bold text-[#0A2540] mb-4">{section.title}</h2>
              <ul className="space-y-2">
                {section.body.map((point, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-600 leading-relaxed">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#00C853] flex-shrink-0" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-gray-400">
          Also see our{' '}
          <Link to="/terms" className="text-[#00C853] hover:underline">
            Terms &amp; Conditions
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
