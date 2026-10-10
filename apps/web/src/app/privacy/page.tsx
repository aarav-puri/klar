import type { Metadata } from "next";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteNav } from "@/components/marketing/site-nav";
import { getViewer } from "@/server/viewer";

export const metadata: Metadata = { title: "Privacy Policy" };

const EFFECTIVE = "October 9, 2026";

export default async function PrivacyPage() {
  const signedIn = (await getViewer()).kind === "user";
  return (
    <>
      <SiteNav signedIn={signedIn} />
      <main id="main" className="mx-auto max-w-2xl px-5 py-16 sm:px-8">
        <h1 className="text-4xl font-extrabold tracking-tight">Privacy Policy</h1>
        <p className="mt-3 text-sm text-ink-3">Effective {EFFECTIVE}</p>

        <div className="mt-8 space-y-3 text-ink-2">
          <p>
            This Privacy Policy explains how Klar (&ldquo;Klar,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) collects, uses, shares and protects information when you use
            the Klar website, web application and browser extension (together, the &ldquo;Service&rdquo;). By creating an account or using the Service, you agree to
            this Policy. If you do not agree, do not use the Service.
          </p>
          <p>
            Klar is an independent service. It is not affiliated with, endorsed by or operated on behalf of Schoology, PowerSchool, or any school or school district.
          </p>
        </div>

        <Section n={1} title="Information we collect">
          <p>
            <strong>Account information.</strong> When you create an account, we collect your email address, first name and a password you choose for Klar.
            Passwords are processed by our authentication provider and stored only as a salted hash; we never see or store your password in readable form.
          </p>
          <p>
            <strong>Schoology information you choose to sync.</strong> When you connect Schoology and sync, we collect the information shown in your Schoology
            gradebook, including:
          </p>
          <ul>
            <li>course names, sections and teacher names;</li>
            <li>assignment titles, due dates, scores, points possible and status (for example missing, excused or late);</li>
            <li>grading categories, category weights and grading periods;</li>
            <li>course grades and any teacher comments shown with your grades;</li>
            <li>the name shown on your Schoology gradebook and the address of your school&rsquo;s Schoology site.</li>
          </ul>
          <p>We also record a snapshot of each course grade over time so we can show your grade history. This history begins at your first sync.</p>
          <p>
            <strong>Official Schoology API (optional).</strong> If you connect through Schoology&rsquo;s official authorization, we store an access token issued by
            Schoology, encrypted, so that we can read your grades on your behalf.
          </p>
          <p>
            <strong>Ask Klar.</strong> When you send a question to Ask Klar, we process your question, the earlier messages in that conversation, and your synced
            grade information in order to generate an answer. We do not store your conversations; they are discarded when you leave the page. We keep a
            count of the questions you send each day, without their content, to apply usage limits.
          </p>
          <p>
            <strong>Technical information.</strong> Our hosting and infrastructure providers may automatically log technical information such as IP address,
            browser type, and the date and time of requests, which we use for security, rate limiting and troubleshooting. Our application logs record error codes
            and do not record your grades.
          </p>
          <p>
            <strong>Cookies and local storage.</strong> We use a strictly necessary, secure session cookie to keep you signed in. We store a small number of
            preferences, such as your light or dark theme, in your browser&rsquo;s local storage. We do not use advertising or third-party tracking cookies.
          </p>
        </Section>

        <Section n={2} title="Information we do not collect">
          <ul>
            <li>Your Schoology, school or identity-provider password.</li>
            <li>Your Schoology login cookies or session tokens.</li>
            <li>Messages, files, other students&rsquo; information, or any Schoology page other than your gradebook.</li>
            <li>Your browsing activity on other websites.</li>
          </ul>
        </Section>

        <Section n={3} title="The Klar browser extension">
          <p>
            The extension runs only on Schoology and on Klar&rsquo;s own website. It reads your Schoology gradebook only when you start a sync, and passes that
            information to your Klar account. It does not request access to your cookies, browsing history or other websites.
          </p>
          <p>
            The extension stores a small amount of information in your browser: your school&rsquo;s Schoology address, when you gave consent, and the time and
            status of your last sync. Removing the extension or choosing Disconnect deletes this information from your browser.
          </p>
        </Section>

        <Section n={4} title="How we use information">
          <p>We use the information described above to:</p>
          <ul>
            <li>provide the Service, including showing your grades, calculating grade estimates, what-if scenarios and GPA, and answering Ask Klar questions;</li>
            <li>maintain your account, authenticate you and send password-reset emails you request;</li>
            <li>protect the Service and its users, including preventing abuse and enforcing rate limits;</li>
            <li>diagnose problems and improve the reliability of the Service;</li>
            <li>comply with legal obligations.</li>
          </ul>
          <p>
            We do not sell your personal information, share it for cross-context behavioral advertising, show you advertising, or use your grades to build
            advertising profiles.
          </p>
        </Section>

        <Section n={5} title="How we share information">
          <p>We share information only as described below.</p>
          <ul>
            <li>
              <strong>Service providers.</strong> We use providers that process information on our behalf to operate the Service: Neon (database hosting, account
              authentication and password-reset email delivery), our web hosting provider, and, only when you use Ask Klar, Vercel AI Gateway and OpenAI, which
              process your question and grade information to generate an answer. These providers handle information under their own terms and privacy policies.
            </li>
            <li>
              <strong>Legal reasons.</strong> We may disclose information if we believe in good faith that it is required by law, regulation, legal process or
              governmental request, or is necessary to protect the rights, property or safety of Klar, our users or others.
            </li>
            <li>
              <strong>Business transfers.</strong> If Klar is involved in a merger, acquisition, financing or sale of assets, information may be transferred as
              part of that transaction, subject to this Policy.
            </li>
          </ul>
          <p>We do not share your information with your school, teachers or parents.</p>
        </Section>

        <Section n={6} title="Data retention">
          <p>
            We keep your account and synced information for as long as your account exists or until you delete it. You can delete your synced grade information or
            your entire account at any time in Settings; deletion takes effect immediately in our live systems. Residual copies may remain in our database
            provider&rsquo;s backups for a limited period before they are overwritten.
          </p>
        </Section>

        <Section n={7} id="delete" title="Your choices and rights">
          <ul>
            <li>
              <strong>Access.</strong> All of the grade information we hold about you is shown in your Klar dashboard.
            </li>
            <li>
              <strong>Correction.</strong> Synced information comes from Schoology. If it is inaccurate, correct it with your school, then sync again.
            </li>
            <li>
              <strong>Disconnect.</strong> Disconnecting Schoology in Settings stops syncing and deletes any stored Schoology access token. Your synced grades remain
              until you delete them.
            </li>
            <li>
              <strong>Delete my grade data.</strong> Removes your synced courses, assignments, grades, history and connection.
            </li>
            <li>
              <strong>Delete my Klar account.</strong> Removes your account and all associated information.
            </li>
          </ul>
          <p>
            Depending on where you live, you may have additional rights under applicable law, such as the right to request a copy of your information. Klar does
            not sell personal information.
          </p>
        </Section>

        <Section n={8} title="Children">
          <p>
            You must be at least 13 years old to use Klar. We do not knowingly collect personal information from children under 13. If we learn that we have
            collected information from a child under 13, we will delete it promptly.
          </p>
        </Section>

        <Section n={9} title="Students and schools">
          <p>
            Students use Klar on their own initiative. Klar is not provided by or on behalf of any school. Klar reads only information that you can already see in
            your own Schoology account, and only after you give consent.
          </p>
        </Section>

        <Section n={10} title="Security">
          <p>We use reasonable technical and organizational measures to protect your information, including:</p>
          <ul>
            <li>encryption in transit (HTTPS) and strict security headers;</li>
            <li>database-level access controls that restrict each record to its owner;</li>
            <li>encryption of stored Schoology access tokens;</li>
            <li>validation of all information received from Schoology, cross-site request protection and rate limits.</li>
          </ul>
          <p>No method of transmission or storage is completely secure, and we cannot guarantee absolute security.</p>
        </Section>

        <Section n={11} title="International processing">
          <p>
            Klar and its service providers may process and store information in the United States and other countries where they operate. These countries may have
            data protection laws that differ from those where you live.
          </p>
        </Section>

        <Section n={12} title="Changes to this Policy">
          <p>
            We may update this Policy from time to time. When we do, we will change the effective date above. If we make material changes, we will provide notice
            through the Service before the changes take effect. Continuing to use the Service after a change takes effect means you accept the updated Policy.
          </p>
        </Section>

        <p className="mt-12 border-t border-line pt-6 text-sm text-ink-3">Schoology and PowerSchool are trademarks of their respective owners.</p>
      </main>
      <SiteFooter />
    </>
  );
}

function Section({ n, id, title, children }: { n: number; id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-12 scroll-mt-24">
      <h2 className="text-xl font-bold tracking-tight">
        {n}. {title}
      </h2>
      <div className="mt-3 space-y-3 text-ink-2 [&_li]:mt-1.5 [&_strong]:text-ink [&_ul]:list-disc [&_ul]:pl-5">{children}</div>
    </section>
  );
}
