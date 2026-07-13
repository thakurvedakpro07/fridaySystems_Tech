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
  "End User",
  "Server & Infrastructure",
  "Cloud Platforms",
  "DevOps & Automation",
  "Data",
];

export const SERVICES = [
  {
    id: "laptop_desktop",
    category: "End User",
    name: "Laptop / Desktop Support",
    shortDesc: "Windows, macOS, Linux desktops and laptops, software installation, troubleshooting",
    desc: "Business endpoint support including Windows, macOS, Linux desktops, laptops, software installation, troubleshooting, hardware diagnostics and end-user support.",
    responseTime: "30 min – 4 hrs",
    resolutionTime: "Varies by complexity",
    accent: "cyan",
    featured: true,
    issues: [
      "Driver conflicts & hardware detection failures",
      "Software installation & endpoint troubleshooting",
      "Network connectivity & Wi-Fi issues",
      "OS performance, startup errors & crashes",
    ],
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
      </svg>
    ),
  },
  {
    id: "server_admin",
    category: "Server & Infrastructure",
    name: "Server Administration Support",
    shortDesc: "Windows Server and Linux Server administration, Active Directory, patching, monitoring",
    desc: "Windows Server and Linux Server administration including Active Directory, patching, monitoring, storage, virtualization and server maintenance.",
    responseTime: "30 min – 4 hrs",
    resolutionTime: "Varies by complexity",
    accent: "indigo",
    featured: true,
    issues: [
      "Active Directory replication & account lockouts",
      "Server crashes, resource exhaustion & boot issues",
      "Patch scheduling & maintenance windows",
      "Storage, virtualization & server maintenance",
    ],
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
      </svg>
    ),
  },
  {
    id: "aws",
    category: "Cloud Platforms",
    name: "AWS Support",
    shortDesc: "EC2, VPC, IAM, S3, RDS, CloudWatch, Load Balancers and related cloud services",
    desc: "Amazon Web Services administration including EC2, VPC, IAM, S3, RDS, CloudWatch, Load Balancers and related cloud services.",
    responseTime: "30 min – 4 hrs",
    resolutionTime: "Varies by complexity",
    accent: "amber",
    featured: true,
    issues: [
      "EC2 performance & scaling issues",
      "IAM policy misconfiguration & access errors",
      "S3 bucket policy & storage troubleshooting",
      "RDS performance tuning & backup failures",
    ],
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
      </svg>
    ),
  },
  {
    id: "azure",
    category: "Cloud Platforms",
    name: "Azure Support",
    shortDesc: "Virtual Machines, Azure AD, Networking, Storage, Resource Groups, Monitoring and Identity",
    desc: "Microsoft Azure administration including Virtual Machines, Azure AD, Networking, Storage, Resource Groups, Monitoring and Identity.",
    responseTime: "30 min – 4 hrs",
    resolutionTime: "Varies by complexity",
    accent: "blue",
    featured: true,
    issues: [
      "Virtual Machine connectivity & NSG rule issues",
      "Azure AD conditional access & identity issues",
      "Resource Group & networking misconfiguration",
      "Storage account access & monitoring alerts",
    ],
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    id: "kubernetes",
    category: "Server & Infrastructure",
    name: "Kubernetes Support",
    shortDesc: "Cluster management, deployments, scaling, ingress, troubleshooting",
    desc: "Container orchestration, cluster management, deployments, scaling, ingress, troubleshooting and Kubernetes platform operations.",
    responseTime: "30 min – 4 hrs",
    resolutionTime: "Varies by complexity",
    accent: "sky",
    featured: true,
    issues: [
      "Pod crash loops & scheduling failures",
      "Ingress controller & load balancing issues",
      "Cluster scaling & node pool troubleshooting",
      "Deployment rollouts & rollback support",
    ],
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
      </svg>
    ),
  },
  {
    id: "database",
    category: "Data",
    name: "Database Support",
    shortDesc: "Administration, monitoring, backup, tuning for PostgreSQL, MySQL, SQL Server, MongoDB",
    desc: "Administration, monitoring, backup, tuning and troubleshooting for PostgreSQL, MySQL, SQL Server, MongoDB and similar databases.",
    responseTime: "30 min – 4 hrs",
    resolutionTime: "Varies by complexity",
    accent: "violet",
    featured: true,
    issues: [
      "Replication lag & failover troubleshooting",
      "Backup failures & recovery procedures",
      "Query performance tuning & indexing",
      "Database monitoring & capacity planning",
    ],
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
      </svg>
    ),
  },
  {
    id: "devops_cicd",
    category: "DevOps & Automation",
    name: "DevOps CI/CD Support",
    shortDesc: "GitHub Actions, GitLab CI, Jenkins, Docker pipelines, deployments, release automation",
    desc: "GitHub Actions, GitLab CI, Jenkins, Docker pipelines, deployments, release automation, infrastructure delivery and CI/CD troubleshooting.",
    responseTime: "30 min – 4 hrs",
    resolutionTime: "Varies by complexity",
    accent: "emerald",
    featured: true,
    issues: [
      "Pipeline failures & build errors",
      "Docker image builds & registry authentication",
      "Deployment automation & release rollback",
      "CI/CD troubleshooting across GitHub Actions, GitLab CI, Jenkins",
    ],
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
      </svg>
    ),
  },
  {
    id: "infra_automation",
    category: "DevOps & Automation",
    name: "Infrastructure Platform Automation Support",
    shortDesc: "Terraform, Ansible, scripting, provisioning and platform automation",
    desc: "Infrastructure as Code, automation and configuration management including Terraform, Ansible, scripting, provisioning and platform automation.",
    responseTime: "30 min – 4 hrs",
    resolutionTime: "Varies by complexity",
    accent: "teal",
    featured: true,
    issues: [
      "Terraform state issues & drift resolution",
      "Ansible playbook failures & provisioning errors",
      "Infrastructure as Code design & review",
      "Configuration management & automation scripting",
    ],
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];
