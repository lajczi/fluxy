import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-gray-300">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <h1 className="text-2xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: March 9, 2026</p>

        <div className="space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">1. What we collect</h2>
            <p>Fluxy collects and stores only the data necessary for its features to function:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
              <li>
                <strong className="text-gray-300">User ID</strong> - your Fluxer account ID, used to identify you across
                features
              </li>
              <li>
                <strong className="text-gray-300">Personal settings</strong> - custom prefix preferences you set
              </li>
              <li>
                <strong className="text-gray-300">Moderation records</strong> - warnings, bans, kicks, and other actions
                involving you
              </li>
              <li>
                <strong className="text-gray-300">Ticket messages</strong> - messages you send inside support ticket
                channels
              </li>
              <li>
                <strong className="text-gray-300">Command usage</strong> - which commands you use (for analytics, not
                message content)
              </li>
            </ul>
            <p className="mt-2">
              We do <strong className="text-gray-300">not</strong> collect or store your password, email, payment
              information, or the content of your regular messages outside of ticket channels.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">2. How we use your data</h2>
            <p>Your data is used exclusively to provide Fluxy's features:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
              <li>Moderation records help server staff manage their communities</li>
              <li>Ticket transcripts provide accountability for support interactions</li>
              <li>Personal settings let you customize your experience</li>
              <li>Command usage helps us understand which features are used</li>
            </ul>
            <p className="mt-2">
              We do not sell, share, or provide your data to third parties. Data is only visible to server staff within
              the context it was created (e.g., a server's moderation log stays in that server).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">3. Data storage</h2>
            <p>
              Your data is stored in a secured MongoDB database. Access is restricted to the bot's backend services and
              the authenticated dashboard. We use encrypted connections (TLS) for all data in transit.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">4. Your rights</h2>
            <p>Regardless of where you are located, you have the right to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
              <li>
                <strong className="text-gray-300">Access your data</strong> - use{' '}
                <code className="bg-white/5 px-1 rounded">!mydata export</code> or the "Your Data" page in the dashboard
              </li>
              <li>
                <strong className="text-gray-300">Delete your data</strong> - use{' '}
                <code className="bg-white/5 px-1 rounded">!mydata delete</code> or the "Your Data" page in the dashboard
              </li>
              <li>
                <strong className="text-gray-300">Know what is stored</strong> - use{' '}
                <code className="bg-white/5 px-1 rounded">!mydata</code> for a summary
              </li>
            </ul>
            <p className="mt-2">
              When you delete your data, personal settings and warnings are permanently removed. Moderation logs and
              ticket transcripts are anonymized (your identity is replaced with "Deleted User") to preserve the server's
              audit trail.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">5. Authentication</h2>
            <p>
              Fluxy uses Fluxer's OAuth2 system for login. We receive a temporary access token to verify your identity
              and fetch your server list. We do not have access to your Fluxer password. Auth tokens are stored in
              secure httpOnly cookies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">6. Analytics</h2>
            <p>
              The dashboard may use privacy-respecting analytics (PostHog) to understand usage patterns (Default is
              off.). You can opt out of analytics from the dashboard settings. Analytics data is not linked to your
              Fluxer identity.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">7. Changes to this policy</h2>
            <p>
              We may update this policy from time to time. Significant changes will be announced. Continued use of Fluxy
              after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">8. Contact</h2>
            <p>
              If you have questions about your data or this policy, reach out to the bot owner through the Fluxy support
              server or via Fluxer DM.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
