import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function TermsOfService() {
  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-gray-300">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link to="/login" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <h1 className="text-2xl font-bold text-white mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: March 9, 2026</p>

        <div className="space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">1. Acceptance</h2>
            <p>By logging into the Fluxy dashboard or adding Fluxy to your server, you agree to these Terms of Service and our <Link to="/privacy" className="text-blue-400 hover:underline">Privacy Policy</Link>. If you do not agree, do not use the service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">2. What Fluxy is</h2>
            <p>Fluxy is a moderation and server management bot for the Fluxer platform. It provides tools for moderation, automod, tickets, welcome messages, reaction roles, and other server management features. The dashboard is a web interface for managing these features.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">3. Your responsibilities</h2>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
              <li>You must have authority to manage the servers you configure through the dashboard</li>
              <li>You must not use Fluxy to harass, stalk, or target other users</li>
              <li>You must not attempt to exploit, overload, or interfere with the bot or its infrastructure</li>
              <li>You must not use Fluxy to violate Fluxer's own Terms of Service</li>
              <li>You are responsible for the moderation actions taken through Fluxy in servers you manage</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">4. Service availability</h2>
            <p>Fluxy is provided as-is. We do our best to keep the bot and dashboard running, but we do not guarantee 100% uptime. The service may be temporarily unavailable for maintenance, updates, or due to issues beyond our control. We are not liable for any disruption caused by downtime.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">5. Data and privacy</h2>
            <p>Your use of Fluxy is also governed by our <Link to="/privacy" className="text-blue-400 hover:underline">Privacy Policy</Link>, which explains what data we collect, how it is used, and how you can request its export or deletion.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">6. Global ban system</h2>
            <p>Fluxy maintains a global ban list of users identified as spam, scam, or raid accounts. Servers with global ban protection enabled will automatically ban users on this list when they join. Server owners can opt out of this system at any time using <code className="bg-white/5 px-1 rounded">!globalban off</code>.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">7. Termination</h2>
            <p>We reserve the right to restrict or terminate access to Fluxy for users who violate these terms, abuse the service, or use it in ways that harm others. You may stop using Fluxy at any time by removing the bot from your server and deleting your data via <code className="bg-white/5 px-1 rounded">!mydata delete</code>.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">8. Changes to these terms</h2>
            <p>We may update these terms from time to time. Significant changes will be announced. Continued use of Fluxy after changes constitutes acceptance of the updated terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">9. Contact</h2>
            <p>If you have questions about these terms, reach out to the bot owner through the Fluxy support server or via Fluxer DM.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
