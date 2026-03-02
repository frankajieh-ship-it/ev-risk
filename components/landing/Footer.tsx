import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div>
            <span className="text-xl font-bold text-white">OFFO</span>
            <p className="mt-2 text-sm leading-relaxed">
              Your trusted second opinion for used EV shopping. Know if it&apos;s a good deal before the test drive.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Product</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#how-it-works" className="hover:text-white transition-colors">How it Works</a></li>
              <li><a href="#pricing" className="hover:text-white transition-colors">Buyer Pass</a></li>
              <li><span className="text-gray-500">Deal Watch <span className="text-xs">(coming soon)</span></span></li>
              <li><Link href="/extension" className="hover:text-white transition-colors">Browser Extension</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Support</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact Us</Link></li>
              <li><span className="text-gray-500">Privacy Policy</span></li>
              <li><span className="text-gray-500">Terms of Service</span></li>
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
