// Everything a visitor reads lives here, so copy edits never touch the scene code.
import type { Phase } from './clock'

export type ActionKind = 'projects' | 'resume' | 'message'
export interface ObjectAction {
  kind: ActionKind
  label: string
  project?: string // which project 'projects' opens on
}
export interface ObjectInfo {
  label: string
  title?: string
  body?: string
  byPhase?: Partial<Record<Phase, { title?: string; body?: string }>>
  action?: ObjectAction
  toggle?: boolean
  localTime?: boolean
}

// `satisfies` checks every field while keeping the keys literal, so ObjectId
// below is the exact list of ids; OBJECTS then exposes each entry as ObjectInfo.
const OBJECT_INFO = {
  raj: {
    label: 'Raj at the desk',
    title: "Hi, I'm Raj.",
    body: "Full-stack software engineer in Tempe with 5+ years building web and mobile apps and the cloud backends behind them. Most of what I've built is somewhere in this room.",
    action: { kind: 'resume', label: 'Just the résumé' },
  },
  laptop: {
    label: 'MacBook',
    title: 'This is where the projects live.',
    body: 'Pitchfork Pantry is the one on screen right now. There are three more behind it.',
    action: { kind: 'projects', label: 'See projects' },
  },
  coffee: {
    label: 'Coffee',
    title: 'Third cup.',
    body: "This one goes to Pitchfork Pantry, the food pantry app I'm getting ready for the App Store and Google Play.",
    // the room follows the visitor's clock, so the coffee does too
    byPhase: {
      evening: { title: 'Last cup of the day.' },
      night: { title: 'Probably decaf by now.' },
    },
    action: { kind: 'projects', label: 'See the app', project: 'pantry' },
  },
  books: {
    label: 'Bookshelf',
    title: 'Always learning.',
    body: "This shelf holds the long haul: an M.S. in Computer Science from Arizona State, a B.Tech. in Information Technology, and the AWS Certified Developer notes I still reach for. It keeps growing with whatever I'm learning next, and that's the point.",
    action: { kind: 'resume', label: 'Read my experience' },
  },
  medals: {
    label: 'Race medals',
    title: 'Finish lines.',
    body: "Running is my reset button. These medals aren't about fast times; they're about showing up on the days I didn't feel like it. Most of what I know about consistency, in code and out of it, I learned one mile at a time.",
  },
  tv: {
    label: 'TV and Xbox',
    title: 'Off the clock.',
    body: "When the laptop closes, I head outside: a hiking trail, a sunrise, a long run. I spend a lot of time around art, and there's always a new skill I'm working on. What I enjoy most is the people along the way. I learn fastest from someone who sees a problem differently, and I like passing it on to the next person.",
  },
  showPoster: {
    label: "Poster: what I'm watching",
    title: "What I'm watching.",
    body: '"Every second counts." The mantra on the kitchen wall in The Bear, and how I think about building things: care about the small moments, because the people using your work feel every one of them.',
  },
  gamePoster: {
    label: 'Poster: art on the wall',
    title: 'Why so much art?',
    body: "I like having art around the places I spend my time. It keeps me curious, and it's a quiet reminder that good work needs taste as well as function. That's the balance I try to bring to everything I build, which is why this room has a print on almost every wall.",
  },
  door: {
    label: 'Glass door',
    title: "What's next.",
    body: "I'm looking for an SDE role on a large-scale product, building reliable backend and cloud systems and the features they power. I pick up new languages and frameworks quickly and go where the product needs me. Based in Tempe, Arizona, and open to roles anywhere in the US.",
    localTime: true, // adds a live line with the time in Tempe
    action: { kind: 'message', label: "Let's talk" },
  },
  // no bubble: clicking the window just opens or closes it (handled in App)
  window: {
    label: 'Window: open or close it',
    toggle: true,
  },
} satisfies Record<string, ObjectInfo>

export type ObjectId = keyof typeof OBJECT_INFO
export const OBJECTS: Record<ObjectId, ObjectInfo> = OBJECT_INFO
// For ids read from the DOM or other untyped places.
export const isObjectId = (x: unknown): x is ObjectId => typeof x === 'string' && x in OBJECTS

// The roles that type themselves out under your name: "Open to ___ roles".
export const ROLES = ['software engineer', 'full-stack', 'cloud developer']

// The "Get in touch" form posts to this Formspree form, which emails each
// message to you. Set endpoint to null and Send opens the visitor's email app
// with their message filled in instead.
export const CONTACT_FORM: { endpoint: string | null; intro: string } = {
  endpoint: 'https://formspree.io/f/xkjrvkle',
  intro: "Hiring for a full-stack role, building something interesting, or just want to say hi? Send me a note and I'll reply.",
}

// Your time zone, for the door's "it's 9:14 pm in Tempe" line. Outside
// awakeFrom to awakeUntil (24-hour clock) it says you'll reply in the morning.
export const HOME_TIME = { city: 'Tempe', timeZone: 'America/Phoenix', awakeFrom: 7, awakeUntil: 22 }

export const CONTACT: { label: string; href: string }[] = [
  { label: 'shreyanshrc01@gmail.com', href: 'mailto:shreyanshrc01@gmail.com' },
  { label: 'LinkedIn', href: 'https://linkedin.com/in/shreyanshraj' },
  { label: 'GitHub', href: 'https://github.com/shreyanshraj' },
]

export interface Project {
  id: string
  name: string
  summary: string
  stack: string
  status?: string
  link?: string
}
export const PROJECTS: Project[] = [
  {
    id: 'pantry',
    name: 'Pitchfork Pantry',
    summary:
      "A mobile app for a food pantry organization, planned for about 500 students a week across 4 campuses and up to 10 check-ins at once. I'm the sole developer. QR check-in cut each check-in from about 20 seconds to under 3, and it also runs surveys, a waitlist and volunteer tracking.",
    stack: 'React Native, TypeScript, Firebase',
    status: 'App Store and Google Play submission in preparation',
  },
  {
    id: 'cab',
    name: 'Cab trajectory visualization',
    summary: 'Cleaned 500K+ GPS cab-trip records and plotted their trajectories on an interactive map, fast enough to explore demand patterns in under a second.',
    stack: 'Pandas, D3.js',
    link: 'https://github.com/shreyanshraj/ShreyanshRaj-Traffic-Visualization',
  },
  {
    id: 'migration',
    name: 'Data migration tool',
    summary:
      'Built at Infosys: moved Work Breakdown Structure data from legacy systems into a new SAP S/4HANA platform at 1M records a week, cut upload time by 50% with no manual monitoring, and flagged failed uploads in reconciliation reports.',
    stack: 'SAP S/4HANA, ABAP OO, CDS Views, AMDP',
  },
  {
    id: 'cctv',
    name: 'Real-time face recognition on CCTV streams',
    summary:
      'A serverless computer-vision pipeline that sustains 500+ frames a minute with auto-scaling. Async SQS messaging and batched Lambda calls cut end-to-end latency by 80%, and keeping one instance warm made processing about 40% faster.',
    stack: 'AWS (EC2, SQS, S3, Lambda), Docker, Kubernetes, OpenCV',
    link: 'https://github.com/shreyanshraj/AWS-Cloud-Facial-Recogniition',
  },
]

// Image files for the two posters above the TV. Leave as null to show the
// original painted prints. To use your own, put the images in public/posters/
// and set e.g. show: 'posters/my-show.jpg'. Any size works; it's cropped to fit.
export const POSTER_IMAGES: { show: string | null; game: string | null } = {
  show: null,
  game: null,
}

// The résumé page (#resume). Taken from the SDE2 full-stack résumé.
interface Resume {
  name: string
  summary: string
  experience: { company: string; title: string; dates: string; tech: string; bullets: string[] }[]
  projects: { name: string; tech: string; note: string; link?: string; text: string }[]
  education: { degree: string; school: string; dates: string }[]
  skills: [label: string, list: string][]
}
export const RESUME: Resume = {
  name: 'Shreyansh Raj',
  summary:
    'Software engineer with 5+ years building distributed systems, cloud services and microservices, and the web and mobile apps that run on them. Designs event-driven, auto-scaling backends on AWS (Lambda, SQS, S3, DynamoDB) and Firebase, builds REST APIs and data pipelines in Python and TypeScript, and ships product features in React and React Native. Owns work from design through production, works directly with stakeholders and designers, and mentors junior engineers. AWS Certified Developer – Associate.',
  experience: [
    {
      company: 'Objectways Technologies',
      title: 'Software Engineer',
      dates: 'May 2026 – Oct 2026',
      tech: 'Python, AWS (S3, Boto3), Imitation Learning',
      bullets: [
        'Collected 2,000+ teleoperated demonstration episodes on Trossen robotic arms across everyday home tasks, rejecting under 2% as failed, to deliver clean training data for home-robot learning models.',
        'Developed a nightly Python pipeline in one week that validates robot episodes for missing camera streams and corrupt files, then uploads about 30 GB of video and sensor data to S3, saving the 3-person annotation team 2 hours of manual work daily.',
        'Optimized the teleoperation workflow by tuning a wait parameter so operators set up once instead of after every episode, saving about 3.6 hours of operator time daily across 13 operators.',
      ],
    },
    {
      company: 'Arizona State University',
      title: 'Graduate Student Software Engineer',
      dates: 'Oct 2023 – May 2026',
      tech: 'TypeScript, Python, React, AWS (DynamoDB, Lambda, RDS, IAM), Firebase, GitHub Actions, LLM tool calling, REST APIs',
      bullets: [
        'Designed and led delivery of “Huddles,” an LLM-powered meeting tool built with TypeScript and React that auto-generates agendas using LLM tool calling and batched API calls, with a projected 45% reduction in meeting preparation time; added GitHub Actions checks to validate every push to staging; partnered with designers to refine UI and UX.',
        'Built a shift-scheduling mobile app from scratch on Firebase (Firestore, Auth, Cloud Functions, FCM) for 15 direct reports across 2 campuses, handling around 100 shifts a week.',
        'Led configuration and rollout of a campus-wide inventory management platform for 1,000+ users, automating reconciliation and saving 2,000+ hours of manual work a year; trained 20 people, including 15 direct reports and 5 supervisors and school leaders.',
        'Managed 15 direct reports across 2 campuses, improving equipment-team efficiency by 30%; built training plans for 10 junior assistants that cut onboarding from about 1 month to 2 weeks.',
      ],
    },
    {
      company: 'Tata Consultancy Services',
      title: 'Software Developer-2',
      dates: 'Mar 2022 – Jul 2023',
      tech: 'SAP S/4HANA, ABAP OO, Adobe Forms',
      bullets: [
        'Provided production support for two enterprise clients in consumer electronics and banking, resolving defects, tuning performance, and supporting go-live, while translating stakeholder requirements into solutions and mentoring junior developers.',
      ],
    },
    {
      company: 'Infosys Limited',
      title: 'Software Developer',
      dates: 'Jan 2019 – Mar 2022',
      tech: 'SAP S/4HANA, ABAP OO, CDS Views, AMDP, RFC, BAPI, SQL',
      bullets: [
        'Engineered a data migration tool that moved Work Breakdown Structure (WBS) data from legacy systems into a new S/4HANA platform at 1M records a week, cutting upload time by 50% with no manual monitoring, and built reconciliation reports that flagged failed uploads.',
        'Delivered 15+ custom software components for a greenfield implementation across 3 countries, working with development, business and security teams.',
      ],
    },
  ],
  projects: [
    {
      name: 'Pitchfork Pantry',
      tech: 'React Native, TypeScript, Firebase',
      note: 'App Store and Google Play submission in preparation',
      text: 'Sole developer of a mobile app for a food pantry organization, with load balancing and capacity planning for ~500 weekly students across 4 campuses and up to 10 concurrent check-ins; implemented QR-based check-in and authentication, cutting check-in time from ~20 seconds to under 3 seconds; added dynamic surveys, a waitlist, and volunteer tracking.',
    },
    {
      name: 'Cab Trajectory Visualization',
      tech: 'Pandas, D3.js',
      note: 'August 2024',
      link: 'https://github.com/shreyanshraj/ShreyanshRaj-Traffic-Visualization',
      text: 'Cleaned 500K+ GPS cab-trip records with Pandas and plotted trip trajectories on an interactive map with D3.js, enabling sub-second exploration of spatial demand patterns.',
    },
    {
      name: 'Real-Time Face Recognition on CCTV Streams',
      tech: 'AWS (EC2, SQS, S3, Lambda), Docker, Kubernetes, OpenCV',
      note: 'October 2025',
      link: 'https://github.com/shreyanshraj/AWS-Cloud-Facial-Recogniition',
      text: 'Built a serverless computer-vision pipeline sustaining 500+ frames/min with auto-scaling; cut end-to-end latency 80% via async SQS messaging and batched Lambda invocations; fixed Lambda cold starts by keeping an instance warm, making processing ~40% faster.',
    },
  ],
  education: [
    { degree: 'M.S. in Computer Science', school: 'Arizona State University', dates: 'Aug 2023 – May 2025' },
    { degree: 'B.Tech. in Information Technology', school: 'Maharaja Agrasen Institute of Technology', dates: 'Aug 2014 – May 2018' },
  ],
  skills: [
    ['Languages', 'TypeScript, JavaScript, Python, Java, SQL'],
    ['Frontend & mobile', 'React, React Native, Firebase (Firestore, Auth, Cloud Functions, FCM), REST APIs, UI/UX collaboration'],
    ['Backend & data', 'FastAPI, Microservices, Event-Driven Architecture, PostgreSQL, MongoDB, MySQL, DynamoDB; Kafka (foundational)'],
    ['Cloud & DevOps', 'AWS (Lambda, SQS, S3, EC2, ECS, API Gateway, AppConfig, IAM, CDK, CloudWatch), CloudFormation, Docker, Kubernetes, CI/CD (GitHub Actions, Jenkins)'],
    ['Certification', 'AWS Certified Developer – Associate'],
  ],
}
