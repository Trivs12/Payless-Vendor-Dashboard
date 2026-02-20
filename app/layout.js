import './globals.css';

export const metadata = {
  title: 'Campaign Performance Dashboard',
  description: 'Vendor campaign performance analytics and insights',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        {children}
      </body>
    </html>
  );
}
