export type TaskInfo = {
  name: string;
  showOrderType: boolean;
  showLineItems: boolean;
};

export type TaskData = {
  [department: string]: {
    [role: string]: {
      [category: string]: TaskInfo[];
    };
  };
};

// Legacy static fallback data — no longer used since data comes from Supabase.
// Kept for reference only. Type assertion used to avoid updating hundreds of entries.
export const TASK_DATA: Record<string, Record<string, Record<string, string[]>>> = {
  Sales: {
    "Enterprise Business Managers": {
      "Communication & Reporting": [
        "General Administrative Tasks",
        "Internal Meetings",
        "Stakeholder Reporting",
      ],
      "Warehouse Coordination": [
        "Billing Oversight",
        "Inventory Updates & Adjustments",
        "Program Oversight",
      ],
      "Client Management": [
        "Client Meetings",
        "Client Escalation Management",
        "Status calls",
        "Internal Communication",
        "Client Strategy Development",
      ],
      "Team Leadership": [
        "Conflict Resolution",
        "Cross-Functional Collaboration",
        "Culture improvements",
        "Internal Communication",
        "Workload Balancing",
      ],
      "Vendor Management": [
        "Cost Savings Initiatives",
        "Product Identification",
        "Vendor Management & Updates",
      ],
      "Sales Operations": [
        "Client Follow-ups",
        "Regular Order",
        "Product Sourcing & Quoting",
        "Presales Sales Activities",
        "Presentation Deck Preparation",
      ],
      "Quality & Process": [
        "Internal Meetings",
        "Operational Support Tasks",
        "Team Training",
      ],
      "Order Management": [
        "Inventory Monitoring",
        "Program Oversight",
        "Order Issue Resolution",
        "Inventory Reorder Management",
      ],
    },
    "Account Managers": {
      Administration: [
        "General Administrative Tasks",
        "Stakeholder Reporting",
        "Internal Meetings",
        "Team Training",
      ],
      "Reporting & Analytics": [
        "Post-Order Follow-up",
        "Stakeholder Reporting",
        "Order Processing",
        "Other Operational Tasks",
        "Presales Sales Activities",
        "Team Activities",
      ],
      Collaboration: [
        "Internal Meetings",
        "Coverage for Team Members",
        "Cross-Functional Collaboration",
        "Internal Communication",
      ],
      "Order Management": [
        "Tracking Down Previous Art",
        "NetSuite Order Tasks",
        "System Ticket Management",
        "Regular Order",
        "Order Reprocessing",
        "System Wait Time",
      ],
      Presales: [
        "Navigating Complex Art Requirements",
        "Client Deck Support",
        "Complex Project Coordination",
        "Data Collection & Cleanup",
        "Ideation Deck Development",
        "International project and quotes",
        "Shipping Quote Collection",
        "Vendor Management & Updates",
        "Virtual Requests",
        "Virtual Proof Management",
      ],
      "Sales Activity": [
        "Client Meetings",
        "Creative Selling",
        "Presales Sales Activities",
        "Sales Dashboard Review",
      ],
      Systems: [
        "Client Systems Navigation",
        "System Ticket Management",
        "System Wait Time",
        "Sales Dashboard Review",
      ],
      "Project Management": [
        "Complex Project Execution",
        "Order Issue Resolution",
        "Client Escalation Management",
      ],
      "Billing & Finance Coordination": [
        "Invoice Issue Resolution",
        "Invoice Review",
      ],
    },
    "Brand Consultant | Brand Account Manager": {
      "Sales Activity": [
        "Online Order Intake (Auto NetSuite)",
        "Inbound Sales Phone Call Handling",
        "Lead Intake from Email",
        "Website Registration & Inquiry",
        "Inbound Website Chat Lead Handling",
        "Sample Request Intake (Auto NetSuite)",
        "Self-Generated Prospecting Leads",
        "ePromos Generated Leads",
        "Client Meetings",
        "Discovery Calls",
        "CRM - Task Activities",
        "Outbound New Business Prospecting",
      ],
      "Customer Support": ["Inbound Customer Support Phone Call"],
      "Sales Operations": [
        "Internal Task Planning & Management",
        "Sales Dashboard Review",
        "Shipping Quote Collection",
        "Product Sourcing & Pricing Quote",
        "Sales Order Entry in NetSuite",
        "Client Follow-ups",
        "Proactive Product Idea Deck Creation",
      ],
      "Vendor Management": ["Navigating Vendor Contracted Terms"],
      Presales: ["Virtual Sample / Request Management"],
      "Order Management": [
        "NetSuite Order Tasks",
        "Order Follow-ups",
        "Order Reprocessing",
        "Tracking Down Previous Art",
      ],
      "System Management": [
        "System Ticket Management",
        "System Wait Time",
        "Product Add Request Ticket Handling",
        "Existing Product Data Fix / Update",
        "Website Product Data Sheet Tickets",
        "Create Bulk Ticket",
        "Pricing Correction & Feedback",
      ],
      Finance: ["Accounting Intervention"],
      "Website Operations": [
        "Price Match",
        "Order Intake Review & Approval",
        "Manual Sample Request Processing",
      ],
      "Reporting & Analytics": [
        "Online Order to Quote Analysis",
        "Quote to Sales Order Conversion Analysis",
        "Order Processing",
        "Presales Sales Activities",
        "Other Operational Tasks",
        "Team Activities",
        "Activity Performance Dashboard Review",
        "Revenue Performance Dashboard Review",
        "Sales Order Conversion Analysis",
      ],
      Communication: [
        "Email Communication Management",
        "Supplier Order Confirmation Review",
        "NetSuite Template Outreach Emails",
      ],
      "Client Support": ["Client Escalation Management"],
      "Quality & Process": [
        "Internal Meeting for Issue Resolution",
        "Process Issue Investigation & Fix",
        "Training with Team Leads",
      ],
      "Team Leadership": [
        "Team Workload Distribution Management",
        "Team Performance Coaching",
        "Team Culture & Engagement Activities",
        "General Administrative Tasks",
      ],
      Administration: ["Email Communication Management"],
    },
  },
  Program: {
    "Program Account Managers": {
      Strategy: [
        "Strategic Account Planning",
        "Lead Business Review",
        "Client Strategy Development",
        "Growth Opportunity Identification",
        "Presales Sales Activities",
        "Internal Communication",
      ],
      "Team Leadership": [
        "General Administrative Tasks",
        "Cross-Functional Collaboration",
        "Internal Meetings",
        "Marketing Calendar Management",
        "SOP / SLA Maintenance",
        "Internal Communication",
        "Operational Oversight",
      ],
      Reporting: [
        "Write Insights for Business Review",
        "Content Approval",
        "Contract Monitoring",
        "Documentation Maintenance",
        "Stakeholder Reporting",
      ],
      "Client Support": [
        "Client Inquiry Resolution",
        "Client Escalation Management",
        "Fulfillment Issue Resolution - Client",
        "Invoice Issue Resolution",
        "Virtual Proof Management",
      ],
      "Client Management": [
        "Client Meeting Preparation & Leadership",
        "Client Meetings",
        "Cross-Functional Collaboration",
        "Internal Meetings",
        "Strategic Alignment",
      ],
      Compliance: ["Contract Governance", "SOP / SLA Maintenance"],
      "Program Operations": [
        "Contract SOW Knowledge",
        "Inventory Reorder Management",
        "Review Inventory SOPs",
        "Content Approval",
        "Program Oversight",
        "Marketing Calendar Management",
        "Regular Order",
        "Inventory Monitoring",
        "Store Management",
      ],
      "Fulfillment Oversight": [
        "Review Fulfillment Issue Resolution",
        "Fulfillment Issue Resolution - Supplier",
        "Supplier Escalation Resolution",
      ],
      "Sales Operations": [
        "Obtain fitting quotes",
        "Pricing Support",
        "Client Meeting Preparation & Leadership",
        "Merchandising Support",
        "Client Follow-ups",
        "Product Sourcing & Quoting",
      ],
    },
    "Program Specialists": {
      "Order Management": [
        "Backorder Reporting",
        "Inventory Ticket Submission",
        "System Ticket Management",
        "Program Oversight",
        "Order Cancellation Processing",
        "Order Review for Accuracy",
        "System Testing",
      ],
      "Quality Assurance": [
        "Billing Oversight",
        "QA Issue Resolution",
        "QA Ticket Submission",
        "SKU Creation & Maintenance",
        "Warehouse Coordination",
      ],
      "Client Management": [
        "Client Meetings",
        "Presentation Deck Preparation",
        "Stakeholder Reporting",
        "Email Client Communication",
        "Merchandising Support",
      ],
      "Product Management": [
        "Maintain FAQs/content",
        "Image Uploads",
        "SKU Creation & Maintenance",
        "Product Pricing Updates",
        "System Ticket Management",
      ],
      Merchandising: [
        "Content Upload",
        "Product Research",
        "Virtual Proof Management",
      ],
      "Internal Collaboration": ["Internal Meetings", "Internal Communication"],
      "Inventory Management": [
        "Inventory Reorder Report",
        "Pricing Support",
        "Inventory Monitoring",
        "System Sync Monitoring",
        "Variance Report Preparation",
        "Velocity Report Preparation",
      ],
      "Process Management": [
        "System Ticket Management",
        "Create SOP for OnDemand (OE)",
      ],
    },
  },
  QA: {
    "QA - Account Coordinator": {
      Communication: [
        "Administrative Emails",
        "Dialpad Messaging",
        "Email Monitoring",
        "Email Response",
      ],
      "Ticket Management": [
        "Analytics",
        "Due Date Update",
        "Monitor Due Dates",
        "Notes Update",
        "Priority Review",
        "Ticket Closure",
        "Ticket Review",
      ],
      "Order Processing": ["ASN Submission", "CM Creation", "Order Entry"],
      "Claims & Issues": [
        "Claim Status",
        "Order Issue Ticket",
        "Ticket Creation",
        "Ticket for Incorrect Items",
        "UPS Claim",
      ],
      "Customer Support": ["Follow-up", "Return Label"],
      "Inventory Management": ["Inventory Monitoring"],
      "Internal Collaboration": [
        "QA Prevention",
        "QA Training",
        "Sales Coordination",
        "Supplier Relations",
        "Team Escalations",
      ],
      "Customer Service": ["Receipt Confirmation"],
      "Supplier Coordination": ["Replacement Follow-up", "Supplier Follow-up"],
      "Logistics & Shipment": [
        "Return Label Request",
        "Return Shipment",
        "Shipment Rerouting",
        "Tracking Confirmation",
        "Tracking Request",
        "Tracking Status",
      ],
      Documentation: ["Ticket Notes"],
    },
  },
  Operations: {
    "Account Coordinators": {
      Finance: [
        "Invoice Issue Resolution",
        "Confirm Charges Approval",
        "Credit Memo Processing",
        "Credit Memo Request",
        "Invoice Review",
        "Invoice Sending",
        "Payment Confirmation",
      ],
      "Artwork Management": [
        "Artwork Issue Resolution",
        "Artwork File Requests",
        "Mockup Requests",
        "Customer Portal Support",
        "Proof Approval",
        "Proof Sending",
      ],
      "Delegated Tasks": [
        "Send Proofs to Customer",
        "Order Status Monitoring",
        "System Sync Monitoring",
        "Proof Approval",
        "Supplier Order Confirmation Review",
        "Shipping Detail Update",
      ],
      Inventory: [
        "ASN Submission",
        "Provide Backorder Updates to Clients",
        "Inventory Monitoring",
        "Order Update",
        "Documentation Maintenance",
      ],
      Reporting: [
        "Review Backorder and Notify Clients",
        "Backorder Reporting",
        "Incomplete Orders Report",
        "Inventory Tracking Sheet",
        "Open Orders Report Review",
        "Order Status Monitoring",
        "SLA Monitoring",
        "Order Review for Accuracy",
      ],
      Communication: [
        "Respond to Client Inquiries",
        "Customer Complaint Handling",
        "Email Communication Management",
        "Customer Portal Support",
        "Internal Status Call",
        "Supplier Follow-ups",
        "Address Pricing Discrepancies",
        "Address Artwork Questions",
        "Inventory Monitoring",
        "Shipping Delay Management",
      ],
      "Team Support": [
        "Stakeholder Reporting",
        "Presentation Deck Preparation",
        "Product Research",
        "Coverage for Team Members",
        "Drop-ship Coordination",
        "Operational Support Tasks",
        "Internal Meetings",
        "Team Training",
      ],
      "System Management": [
        "Large Artwork File Management",
        "Inventory Tracking Maintenance",
        "Order Status Monitoring",
        "Order Follow-ups",
        "Order System Updates",
        "Ship Date Updates",
        "System Ticket Handling",
        "Vendor Management & Updates",
      ],
      "Issue Resolution": [
        "System Ticket Management",
        "Escalate Supplier or Order Issues",
        "Internal Communication",
        "QA Ticket Submission",
      ],
      "Shipping & Logistics": [
        "Monitor Firm In-Hands Date Order",
        "Shipment Monitoring",
        "Shipping Coordination",
        "Tracking Number Requests From Supplier",
        "Shipping Detail Update",
        "Vendor Tracking Updates",
      ],
      "Platform Operations": [
        "MOAS Reminders",
        "System Sync Monitoring",
        "Program Management",
        "System Management",
      ],
      "Order Management": [
        "Supplier Order Confirmation Review",
        "Order Status Monitoring",
        "Order Review for Accuracy",
        "Special Order Processing",
        "Business Card Order",
        "Regular Order",
        "Supplier Follow-ups",
        "Inventory Monitoring",
        "Artwork Issue Resolution",
        "Firm In-Hands Date Concerns",
      ],
    },
    "Graphic Artist": {
      "Artwork Management": [
        "Art Approvals - Regular Orders",
        "Art Revisions - Regular Orders",
        "Artwork Proof",
        "Artwork Proof Revision",
        "Artwork Recreate",
        "Signature Pic",
        "Virtual Proof Management",
        "Virtual Proof Revision",
        "Virtual Recreate",
      ],
    },
    "Order Processing Executive": {
      "Product & Catalog Management": [
        "System Ticket Management",
        "Shipping Detail Update",
        "Product Pricing Updates",
      ],
      "Order Processing": [
        '"P" Items (Humana) Orders & Blank Orders',
        "Regular Order",
        "Repeat Order",
        "Check Repeat PO#",
        "Encore Badge Orders - Ware House",
        "Humana Badge Orders - ID Line",
        "Humana Badge Orders - Ware House",
        "Custom Order - Regular",
        "Custom Order - Repeat",
        "Rekeys + Badge Order",
        "System Ticket Management",
        "Team Coordination",
        'SF\'ing "P" items - Humana Store',
        "SF'ing OD/Custom",
      ],
      "Shipping & Tracking": [
        "EBS Orders (Stores)",
        "Inventory Tracking Sheet",
        "Shipment Monitoring",
        "Regular Order",
      ],
      "Order Management": [
        "Email to Obtain Ship Date",
        "Supplier Order Confirmation Review",
        "System Ticket Handling",
        "Shipping Detail Update",
      ],
      "Communication Management": [
        "Tracking Updates from NetSuite",
        "Email Communication Management",
        "Email Client Communication",
        "Internal Communication",
      ],
    },
  },
};

export const getDepartments = (): string[] => Object.keys(TASK_DATA);

export const getRolesForDepartment = (department: string): string[] =>
  department ? Object.keys(TASK_DATA[department] || {}) : [];

export const getCategoriesForRole = (
  department: string,
  role: string
): string[] =>
  department && role
    ? Object.keys(TASK_DATA[department]?.[role] || {})
    : [];

export const getTasksForCategory = (
  department: string,
  role: string,
  category: string
): string[] =>
  department && role && category
    ? TASK_DATA[department]?.[role]?.[category] || []
    : [];
