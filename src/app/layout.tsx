import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'College Library LMS - Academic Circulation & Patron Portal',
  description: 'Enterprise 3NF Academic College Library Management System. Circulation desk, patron registration, overdue fine automation, and student self-service portal.',
  keywords: ['College Library LMS', 'Library Management System', 'Academic Circulation', 'Book Lending', 'Overdue Fines', 'Student Portal'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
