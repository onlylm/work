import Link from "next/link";import {Inbox,Plus} from "lucide-react";
export function PageHeader({title,description,action,href}:{title:string;description:string;action?:string;href?:string}){return <div className="page-heading"><div><h2>{title}</h2><p>{description}</p></div>{action&&href&&<Link className="main-button" href={href}><Plus/>{action}</Link>}</div>}
export function Empty({title,description}:{title:string;description:string}){return <div className="empty"><span><Inbox/></span><h3>{title}</h3><p>{description}</p></div>}
export function FormCard({title,children}:{title:string;children:React.ReactNode}){return <section className="form-card"><h3>{title}</h3>{children}</section>}
