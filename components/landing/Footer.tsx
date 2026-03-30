import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div>
            <Image src="/offo-logo.png" alt="OFFO" width={72} height={28} className="h-7 w-auto" />
            <p className="mt-2 text-sm leading-relaxed">
              Your trusted second opinion for used EV shopping. Know if it&apos;s a good deal before the test drive.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Product</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/" className="hover:text-white transition-colors">EV Fit Check</Link></li>
              <li><Link href="/receipt" className="hover:text-white transition-colors">Listing Receipt</Link></li>
              <li><Link href="/news" className="hover:text-white transition-colors">EV News Digest</Link></li>
              <li><Link href="/dealer" className="hover:text-white transition-colors">Dealer Workspace</Link></li>
              <li><Link href="/extension" className="hover:text-white transition-colors">Browser Extension</Link></li>
              <li><span className="text-gray-500">Deal Watch <span className="text-xs">(coming soon)</span></span></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Support</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact Us</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-6 text-center text-xs text-gray-500">
          &copy; {new Date().getFullYear()} OFFO. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
