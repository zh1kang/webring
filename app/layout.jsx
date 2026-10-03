import '../src/style.css';
import localFont from 'next/font/local';

const geist = localFont({src: '../public/fonts/Geist.ttf', variable: '--font-ui', display: 'swap', weight: '100 900'});
const fraunces = localFont({src: '../public/fonts/Fraunces.ttf', variable: '--font-display', display: 'swap', weight: '100 900'});

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
export const metadata = {
  title: 'Firestoners - Princeton webring',
  description: 'Firestoners is a webring of personal websites by Princeton students. Add the badge to your site and join the ring.',
  icons: {icon: `${basePath}/icon.svg`},
};
export const viewport = {themeColor: '#fafafa'};

export default function RootLayout({children}) {
  return <html lang="en" className={`${geist.variable} ${fraunces.variable}`}><body>{children}</body></html>;
}
