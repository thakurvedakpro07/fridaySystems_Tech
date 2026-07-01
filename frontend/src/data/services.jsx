// Single source of truth for the ResolveHQ service catalog.
// Imported by Landing.jsx (FEATURED subset) and ServicesPage.jsx (full catalog).

export const ACCENTS = {
  indigo: {
    icon:   "bg-indigo-50 text-indigo-600",
    badge:  "bg-indigo-50 text-indigo-700 border-indigo-100",
    btn:    "bg-indigo-600 hover:bg-indigo-700",
    ring:   "hover:border-indigo-200",
    border: "border-indigo-100",
    text:   "text-indigo-600",
    bg:     "bg-indigo-50",
    glow:   "shadow-indigo-100",
    shadow: "hover:shadow-indigo-50",
  },
  blue: {
    icon:   "bg-blue-50 text-blue-600",
    badge:  "bg-blue-50 text-blue-700 border-blue-100",
    btn:    "bg-blue-600 hover:bg-blue-700",
    ring:   "hover:border-blue-200",
    border: "border-blue-100",
    text:   "text-blue-600",
    bg:     "bg-blue-50",
    glow:   "shadow-blue-100",
    shadow: "hover:shadow-blue-50",
  },
  violet: {
    icon:   "bg-violet-50 text-violet-600",
    badge:  "bg-violet-50 text-violet-700 border-violet-100",
    btn:    "bg-violet-600 hover:bg-violet-700",
    ring:   "hover:border-violet-200",
    border: "border-violet-100",
    text:   "text-violet-600",
    bg:     "bg-violet-50",
    glow:   "shadow-violet-100",
    shadow: "hover:shadow-violet-50",
  },
  emerald: {
    icon:   "bg-emerald-50 text-emerald-600",
    badge:  "bg-emerald-50 text-emerald-700 border-emerald-100",
    btn:    "bg-emerald-600 hover:bg-emerald-700",
    ring:   "hover:border-emerald-200",
    border: "border-emerald-100",
    text:   "text-emerald-600",
    bg:     "bg-emerald-50",
    glow:   "shadow-emerald-100",
    shadow: "hover:shadow-emerald-50",
  },
  sky: {
    icon:   "bg-sky-50 text-sky-600",
    badge:  "bg-sky-50 text-sky-700 border-sky-100",
    btn:    "bg-sky-600 hover:bg-sky-700",
    ring:   "hover:border-sky-200",
    border: "border-sky-100",
    text:   "text-sky-600",
    bg:     "bg-sky-50",
    glow:   "shadow-sky-100",
    shadow: "hover:shadow-sky-50",
  },
  amber: {
    icon:   "bg-amber-50 text-amber-600",
    badge:  "bg-amber-50 text-amber-700 border-amber-100",
    btn:    "bg-amber-600 hover:bg-amber-700",
    ring:   "hover:border-amber-200",
    border: "border-amber-100",
    text:   "text-amber-600",
    bg:     "bg-amber-50",
    glow:   "shadow-amber-100",
    shadow: "hover:shadow-amber-50",
  },
  cyan: {
    icon:   "bg-cyan-50 text-cyan-600",
    badge:  "bg-cyan-50 text-cyan-700 border-cyan-100",
    btn:    "bg-cyan-600 hover:bg-cyan-700",
    ring:   "hover:border-cyan-200",
    border: "border-cyan-100",
    text:   "text-cyan-600",
    bg:     "bg-cyan-50",
    glow:   "shadow-cyan-100",
    shadow: "hover:shadow-cyan-50",
  },
  orange: {
    icon:   "bg-orange-50 text-orange-600",
    badge:  "bg-orange-50 text-orange-700 border-orange-100",
    btn:    "bg-orange-600 hover:bg-orange-700",
    ring:   "hover:border-orange-200",
    border: "border-orange-100",
    text:   "text-orange-600",
    bg:     "bg-orange-50",
    glow:   "shadow-orange-100",
    shadow: "hover:shadow-orange-50",
  },
  rose: {
    icon:   "bg-rose-50 text-rose-600",
    badge:  "bg-rose-50 text-rose-700 border-rose-100",
    btn:    "bg-rose-600 hover:bg-rose-700",
    ring:   "hover:border-rose-200",
    border: "border-rose-100",
    text:   "text-rose-600",
    bg:     "bg-rose-50",
    glow:   "shadow-rose-100",
    shadow: "hover:shadow-rose-50",
  },
  teal: {
    icon:   "bg-teal-50 text-teal-600",
    badge:  "bg-teal-50 text-teal-700 border-teal-100",
    btn:    "bg-teal-600 hover:bg-teal-700",
    ring:   "hover:border-teal-200",
    border: "border-teal-100",
    text:   "text-teal-600",
    bg:     "bg-teal-50",
    glow:   "shadow-teal-100",
    shadow: "hover:shadow-teal-50",
  },
};

export const CATALOG_CATEGORIES = [
  "All",
  "Server & Infrastructure",
  "Enterprise",
  "Data & Security",
  "End User",
];

export const SERVICES = [
  {
    id: "sap-basis",
    category: "Enterprise",
    name: "SAP Basis Lite",
    shortDesc: "Transport management, system health checks, user administration",
    desc: "Expert SAP Basis support for Indian SMBs — transport management, system health checks, and user administration tasks.",
    responseTime: "30 min – 4 hrs",
    resolutionTime: "Varies by complexity",
    accent: "blue",
    featured: true,
    issues: [
      "Transport request failures & Basis errors",
      "System health checks & performance alerts",
      "User administration & role assignment",
      "Background job scheduling & monitoring",
    ],
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3" />
      </svg>
    ),
  },
  {
    id: "linux-provisioning",
    category: "Server & Infrastructure",
    name: "Linux Provisioning",
    shortDesc: "Server setup, package management, systemd, automation",
    desc: "Server setup and configuration for Ubuntu, RHEL, and CentOS — from bare-metal to production-ready in one engagement.",
    responseTime: "30 min – 4 hrs",
    resolutionTime: "Varies by complexity",
    accent: "amber",
    featured: true,
    issues: [
      "Server crashes, OOM kills & kernel panics",
      "Package management & dependency conflicts",
      "systemd service failures & boot issues",
      "Shell automation, cron jobs & log management",
    ],
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
      </svg>
    ),
  },
  {
    id: "windows-provisioning",
    category: "Server & Infrastructure",
    name: "Windows Provisioning",
    shortDesc: "Windows Server, Active Directory, DNS, DHCP, GPO",
    desc: "Windows Server, Active Directory, and desktop infrastructure setup — domain, DNS, DHCP, Group Policy, and role configuration.",
    responseTime: "30 min – 4 hrs",
    resolutionTime: "Varies by complexity",
    accent: "indigo",
    featured: true,
    issues: [
      "Active Directory replication & account lockouts",
      "Group Policy failures & GPO mis-application",
      "DNS / DHCP misconfiguration & resolution errors",
      "Windows Server roles — IIS, RDS, File Server",
    ],
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    id: "os-patching",
    category: "Server & Infrastructure",
    name: "OS Patching",
    shortDesc: "Managed patching for Windows and Linux nodes",
    desc: "Structured patch management for Windows and Linux fleets — assess, test, deploy, and verify with a full audit trail.",
    responseTime: "30 min – 4 hrs",
    resolutionTime: "Varies by complexity",
    accent: "teal",
    featured: true,
    issues: [
      "Patch scheduling & maintenance windows",
      "Failed Windows Update & WSUS errors",
      "Linux apt / yum / dnf upgrade failures",
      "Post-patch regression testing & rollback",
    ],
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    id: "vmware",
    category: "Server & Infrastructure",
    name: "VMware / Hypervisor",
    shortDesc: "ESXi host management, VM provisioning, storage troubleshooting",
    desc: "ESXi host management, VM lifecycle, storage and network troubleshooting for on-premise virtualisation environments.",
    responseTime: "30 min – 4 hrs",
    resolutionTime: "Varies by complexity",
    accent: "sky",
    featured: true,
    issues: [
      "ESXi PSOD & host stability failures",
      "VM provisioning & snapshot management",
      "vSAN storage degradation & datastore issues",
      "vMotion failures & cluster resource contention",
    ],
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 17.25v2.25a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V4.5A2.25 2.25 0 014.5 2.25h10.5m5.25 5.25V2.25m0 5.25h-5.25m5.25 0L12 12" />
      </svg>
    ),
  },
  {
    id: "security-hardening",
    category: "Data & Security",
    name: "Security Hardening",
    shortDesc: "CIS baseline hardening, access controls, vulnerability remediation",
    desc: "CIS baseline hardening, access control reviews, and vulnerability remediation for Linux, Windows, and virtualised environments.",
    responseTime: "30 min – 4 hrs",
    resolutionTime: "Varies by complexity",
    accent: "rose",
    featured: true,
    issues: [
      "Ransomware response & malware removal",
      "CIS Level 1 & 2 baseline hardening",
      "Access control audits & privilege review",
      "Vulnerability scanning & patch remediation",
    ],
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
  },
  {
    id: "desktop-support",
    category: "End User",
    name: "Desktop / Laptop Support",
    shortDesc: "Remote troubleshooting, driver issues, antivirus, connectivity",
    desc: "Remote diagnosis and resolution for end-user workstations — drivers, connectivity, antivirus, and software issues.",
    responseTime: "30 min – 4 hrs",
    resolutionTime: "Varies by complexity",
    accent: "orange",
    featured: true,
    issues: [
      "Driver conflicts & hardware detection failures",
      "Antivirus & endpoint security issues",
      "Network connectivity & Wi-Fi troubleshooting",
      "OS performance, startup errors & crashes",
    ],
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
      </svg>
    ),
  },

];
