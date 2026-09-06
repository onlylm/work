import type {Metadata,Viewport} from "next";import "./globals.css";
export const metadata:Metadata={title:"个人经营工作台",description:"客户、业务、资金、库存与提醒集中管理",manifest:"/manifest.webmanifest"};export const viewport:Viewport={themeColor:"#176b45",width:"device-width",initialScale:1};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>}
