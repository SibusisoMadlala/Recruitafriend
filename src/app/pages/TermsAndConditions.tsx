const termsSections = [
  {
    title: '1. Account Responsibility',
    body: [
      'You must provide accurate, current information when creating your account, including your CV and contact details.',
      'You are responsible for keeping your login credentials secure and for all activity that happens under your account.',
    ],
  },
  {
    title: '2. Acceptable Use',
    body: [
      'You agree not to post false, misleading, or fraudulent job listings or applications.',
      'You agree not to use the platform for spam or unauthorized advertising.',
      'You agree not to upload harmful, illegal, or inappropriate content.',
    ],
  },
  {
    title: '3. Job Listings & Applications',
    body: [
      'RecruitFriend is a platform that connects job seekers and employers.',
      'We do not guarantee job placement or candidate selection.',
      'We do not independently verify all users or job postings.',
    ],
  },
  {
    title: '4. User Content',
    body: [
      'By uploading your CV or job posts, you grant RecruitFriend permission to display and share this information with relevant users.',
      'You confirm that the content you upload is accurate and does not violate any laws or the rights of others.',
    ],
  },
  {
    title: '5. Privacy & Data Use',
    body: [
      'Your personal data will be handled according to our Privacy Policy.',
      'Information may be shared with recruiters or employers when you apply.',
      'We take reasonable steps to protect your data but cannot guarantee absolute security.',
    ],
  },
  {
    title: '6. Limitation of Liability',
    body: [
      'RecruitFriend is not responsible for any loss, damages, or disputes between users.',
      'RecruitFriend is not responsible for job offers, hiring decisions, or employer conduct.',
      'RecruitFriend is not responsible for external links or third-party services.',
    ],
  },
  {
    title: '7. Account Suspension or Termination',
    body: [
      'We reserve the right to suspend or terminate accounts that violate these terms.',
    ],
  },
];

export default function TermsAndConditions() {
  return (
    <div className="bg-[var(--rf-bg)] py-12 sm:py-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[var(--rf-radius-lg)] border border-[var(--rf-border)] bg-white shadow-[var(--rf-card-shadow)]">
          <div className="border-b border-[var(--rf-border)] bg-[var(--rf-navy)] px-6 py-10 text-white sm:px-10">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--rf-green)]">
              RecruitFriend Legal
            </p>
            <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Terms &amp; Conditions</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">
              By using RecruitFriend, you agree to the following terms. Please read them carefully before using the platform.
            </p>
            <p className="mt-4 text-xs font-medium uppercase tracking-[0.18em] text-slate-300">
              Last updated: 30 April 2026
            </p>
          </div>

          <div className="space-y-8 px-6 py-8 sm:px-10 sm:py-10">
            <section className="rounded-[var(--rf-radius-md)] bg-slate-50 p-5 text-sm leading-7 text-[var(--rf-text)] sm:text-base">
              <p>
                These Terms &amp; Conditions govern your access to and use of RecruitFriend as a job marketplace for job seekers and employers in South Africa.
              </p>
            </section>

            {termsSections.map((section) => (
              <section key={section.title} className="space-y-4">
                <h2 className="text-xl font-bold text-[var(--rf-navy)]">{section.title}</h2>
                <ul className="space-y-3 text-sm leading-7 text-[var(--rf-text)] sm:text-base">
                  {section.body.map((paragraph) => (
                    <li key={paragraph} className="flex gap-3">
                      <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-[var(--rf-green)]" aria-hidden="true" />
                      <span>{paragraph}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            <section className="rounded-[var(--rf-radius-md)] border border-[var(--rf-border)] bg-slate-50 px-5 py-4 text-sm leading-7 text-[var(--rf-muted)] sm:text-base">
              <p>
                If you have questions about these Terms &amp; Conditions, please contact the RecruitFriend team before continuing to use the platform.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}