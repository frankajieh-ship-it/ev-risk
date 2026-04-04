import Link from "next/link";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-24">
        <div className="max-w-md w-full text-center space-y-6">
          <p className="text-6xl font-bold text-gray-200">404</p>
          <h1 className="text-2xl font-bold text-gray-900">Page not found</h1>
          <p className="text-gray-600 text-sm leading-relaxed">
            This page doesn&apos;t exist or may have moved. Head back to check a listing or analyze an auction lot.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link
              href="/receipt"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Analyze a listing
            </Link>
            <Link
              href="/copart"
              className="px-5 py-2.5 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 text-sm font-semibold rounded-xl transition-colors"
            >
              Analyze an auction lot
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
