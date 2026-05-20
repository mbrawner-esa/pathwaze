import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DR_CATEGORIES = [
  {id:'0',label:'Legal Entity',subs:[
    {id:'0.1',label:'Incorporation',docs:['W-9','EIN','Entity Articles of Incorporation']},
    {id:'0.2',label:'State Registration',docs:['Foreign Entity Registration','SDAT Registration','Entity Good Standing Certificate']}
  ]},
  {id:'1',label:'Real Estate',subs:[
    {id:'1.1',label:'Site Control',docs:['Letter of Intent','Executed Lease Agreement','Memorandum of Lease (Recorded)','Property Owner Articles of Incorporation','Property Owner Operating Agreement','Property Card','Property Owner Good Standing Certificate','KMZ']},
    {id:'1.2',label:'Title',docs:['Title Report','Title Commitment','Deed','Deed Exception','SNDA','Parcel Map']},
    {id:'1.3',label:'Surveys',docs:['ALTA Survey']}
  ]},
  {id:'2',label:'Engineering',subs:[
    {id:'2.1',label:'Independent Engineering',docs:['Preliminary IE Report','IE Roof Report - Core Sample Testing Report']},
    {id:'2.2',label:'Electrical',docs:['Preliminary Single Line Diagram','30% Electrical Engineering','Helioscope Report','Shading Analysis','Proposed Equipment Specifications','Final PVSyst Analysis','Utility Engineering Drawings']},
    {id:'2.3',label:'Structural',docs:['Structural Load Analysis Basic','Rooftop Structural Load Analysis Final','30% Structural Engineering','Issued for Construction Structural Engineering']},
    {id:'2.4',label:'Civil',docs:['General Site Plan','Stormwater Management Report (SWPPP)','USGS Desktop Soil Analysis','Topographic Report','Desktop Geotechnical Report','Geotechnical Analysis','Desktop Wetlands and FEMA Analysis']},
    {id:'2.5',label:'Existing Conditions',docs:['As-Built Structural Plans','As-Built Roof and Framing Plans','Roof Inspection and Survey','Drone Flight Imagery','Roof Warranties and Specifications','Underground Utilities Survey']}
  ]},
  {id:'3',label:'Permitting',subs:[
    {id:'3.1',label:'Planning and Zoning',docs:['Desktop Zoning Report','Pre-Approval Zoning Letters','Zoning Exemption Letters']},
    {id:'3.2',label:'Permits',docs:['Required Permits Matrix','Special Use or Conditional Use Permit','Property Tax Agreement and Permit','Building Permit','Electrical Permit','Stormwater Permit','Land Disturbance Permit','DOT Permits','Environmental Permits','Underground Utilities Permit']}
  ]},
  {id:'4',label:'Interconnection',subs:[
    {id:'4.1',label:'Interconnection',docs:['Pre-Application Results','IX Application Form','IX Application Fee','Conditional Approval','IX Agreement (NTP)']}
  ]},
  {id:'5',label:'Construction',subs:[
    {id:'5.1',label:'EPC',docs:['EPC Proposal and Exceptions','EPC Statement of Qualifications','EPC Contract','Limited Notice to Proceed','Payment and Performance Bonds','Construction Schedule','Construction Budget']},
    {id:'5.2',label:'Equipment & Supply',docs:['Module Supply Agreement','Electrical Equipment Quotes','Domestic Content Plan','Domestic Content Reliance Letters']},
    {id:'5.3',label:'Roof Contractor',docs:['Roof Contractor Statement of Qualifications','Roof Contractor Proposal and Exceptions','Roof Contractor Contract','Roof Manufacturer Overburden Form']}
  ]},
  {id:'6',label:'Financial',subs:[
    {id:'6.1',label:'Financial',docs:['Property Tax Model','O&M Proposal','Financial Model','Tax Equity Term Sheet']}
  ]}
]

const USERS = [
  { id: '00000000-0000-0000-0000-000000000001', email: 'morgan@esasolar.com', full_name: 'Morgan Brawner', role: 'admin' as const },
  { id: '00000000-0000-0000-0000-000000000002', email: 'sarah@esasolar.com', full_name: 'Sarah Chen', role: 'team' as const },
  { id: '00000000-0000-0000-0000-000000000003', email: 'james@esasolar.com', full_name: 'James Wright', role: 'team' as const },
]

const ASSIGNEE_ID = '00000000-0000-0000-0000-000000000001'
const SARAH_ID = '00000000-0000-0000-0000-000000000002'
const JAMES_ID = '00000000-0000-0000-0000-000000000003'

const STANDARD_MILESTONES = [
  {label:'Site Assessment Complete',date:'2025-06-01',done:true},
  {label:'Feasibility Report Delivered',date:'2025-07-16',done:true},
  {label:'PPA / Contract Executed',date:'2025-08-30',done:false},
  {label:'Interconnection Application Filed',date:'2025-09-29',done:false},
  {label:'Engineering Design Approved',date:'2025-10-29',done:false},
  {label:'Permit Submitted',date:'2025-11-28',done:false},
  {label:'Permit Approved',date:'2025-12-28',done:false},
  {label:'Equipment Procurement',date:'2026-01-27',done:false},
  {label:'Construction Start',date:'2026-02-26',done:false},
  {label:'Substantial Completion',date:'2026-04-27',done:false},
  {label:'Interconnection Approved',date:'2026-05-17',done:false},
  {label:'PTO / Commercial Operation',date:'2026-06-01',done:false},
]

interface ProjectData {
  projectNumber: string
  name: string
  address: string
  city: string
  state: string
  zip: string
  stage: string
  dealHealth: string
  systemKwdc: number
  systemKwac: number
  annualProductionKwh: number
  utility: string
  rateSchedule: string
  rateScheduleType: string
  annualUsageKwh: number
  peakDemandKw: number
  ahj: string
  region: string
  tranche: string
  lat: number
  lng: number
  facilityType: string
  siteType: string
  siteAcres: number
  roofType: string
  modules: string
  inverters: string
  monitoring: string
  azimuth: string
  tilt: string
  startDate: string | null
  targetCOD: string
  totalCost: number
  itcEligibleCosts: number
  itcIneligibleCosts: number
  estimatedEpcCost: number
  estimatedDevCosts: number
  estimatedIxCosts: number
  developmentFee: number
  itcRate: number
  domesticContentAssumed: boolean
  safeHarborRequired: boolean
  otherIncentivesTotal: number
  incentiveType: string
  contractType: string
  revenueType: string
  offtakerCredit: string
  termMonths: number
  year1ContractPrice: number
  escalationRate: number
  srecTreatment: string
  avoidedCostKwh: number
  yieldKwhKwp: number
  energyGenYear1Mwh: number
  systemType: string
  annualSavings: number
  paybackYears: number
  milestones: { label: string; date: string; done: boolean }[]
}

const PROJECTS: ProjectData[] = [
  {projectNumber:'21460-FL-0011',name:'AdventHealth Zephyrhills',address:'7050 Gall Blvd',city:'Zephyrhills',state:'FL',zip:'33541',stage:'Prospecting',dealHealth:'TBD',systemKwdc:1477,systemKwac:1250,annualProductionKwh:2675348,utility:'Duke Energy',rateSchedule:'GSDT-1',rateScheduleType:'TOU',annualUsageKwh:12800000,peakDemandKw:0,ahj:'Pasco County',region:'Florida — Central',tranche:'TR02 - WFD',lat:28.2333,lng:-82.1833,facilityType:'Acute Care Center',siteType:'Healthcare / Hospital',siteAcres:0,roofType:'N/A',modules:'TBD',inverters:'TBD',monitoring:'TBD',azimuth:'TBD',tilt:'TBD',startDate:'2025-06-01',targetCOD:'TBD',totalCost:3470950,itcEligibleCosts:2824046,itcIneligibleCosts:646904,estimatedEpcCost:2806300,estimatedDevCosts:73872,estimatedIxCosts:0,developmentFee:590778,itcRate:30,domesticContentAssumed:false,safeHarborRequired:false,otherIncentivesTotal:0,incentiveType:'None',contractType:'Energy Services Agreement',revenueType:'Fixed Rate with Escalator',offtakerCredit:'AA - IG',termMonths:360,year1ContractPrice:0.092,escalationRate:2,srecTreatment:'Offtaker Retains',avoidedCostKwh:0.0832,yieldKwhKwp:1815,energyGenYear1Mwh:2682,systemType:'GST',annualSavings:0,paybackYears:0,milestones:STANDARD_MILESTONES},
  {projectNumber:'21460-FL-0009',name:'AdventHealth Sebring',address:'4200 Sun N Lake Blvd',city:'Sebring',state:'FL',zip:'33872',stage:'Prospecting',dealHealth:'TBD',systemKwdc:2472,systemKwac:2000,annualProductionKwh:4010767,utility:'Duke Energy',rateSchedule:'GSDT-1',rateScheduleType:'TOU',annualUsageKwh:13608093,peakDemandKw:0,ahj:'Highlands County',region:'Florida — Central',tranche:'TR02 - WFD',lat:27.4833,lng:-81.4333,facilityType:'Acute Care Center',siteType:'Healthcare / Hospital',siteAcres:0,roofType:'N/A',modules:'TBD',inverters:'TBD',monitoring:'TBD',azimuth:'TBD',tilt:'TBD',startDate:'2025-06-01',targetCOD:'TBD',totalCost:5067805,itcEligibleCosts:4083910,itcIneligibleCosts:983895,estimatedEpcCost:4078965,estimatedDevCosts:86524,estimatedIxCosts:0,developmentFee:902316,itcRate:30,domesticContentAssumed:false,safeHarborRequired:true,otherIncentivesTotal:0,incentiveType:'None',contractType:'Energy Services Agreement',revenueType:'Fixed Rate with Escalator',offtakerCredit:'AA - IG',termMonths:360,year1ContractPrice:0.09,escalationRate:2,srecTreatment:'Offtaker Retains',avoidedCostKwh:0.082,yieldKwhKwp:1622,energyGenYear1Mwh:4011,systemType:'GST-F',annualSavings:0,paybackYears:0,milestones:STANDARD_MILESTONES},
  {projectNumber:'21460-FL-0006',name:'AdventHealth Celebration',address:'400 Celebration Pl',city:'Kissimmee',state:'FL',zip:'34747',stage:'Prospecting',dealHealth:'TBD',systemKwdc:2292.84,systemKwac:1888,annualProductionKwh:3608472,utility:'Duke Energy',rateSchedule:'GSDT-1',rateScheduleType:'TOU',annualUsageKwh:24149165,peakDemandKw:0,ahj:'Osceola County',region:'Florida — Central',tranche:'TR03 - CFD',lat:28.3167,lng:-81.7667,facilityType:'Acute Care Center',siteType:'Healthcare / Hospital',siteAcres:0,roofType:'N/A',modules:'TBD',inverters:'TBD',monitoring:'TBD',azimuth:'TBD',tilt:'TBD',startDate:'2025-06-01',targetCOD:'TBD',totalCost:5044160,itcEligibleCosts:4101820,itcIneligibleCosts:942340,estimatedEpcCost:4127040,estimatedDevCosts:57321,estimatedIxCosts:0,developmentFee:859799,itcRate:30,domesticContentAssumed:false,safeHarborRequired:true,otherIncentivesTotal:0,incentiveType:'None',contractType:'Energy Services Agreement',revenueType:'Fixed Rate with Escalator',offtakerCredit:'AA - IG',termMonths:360,year1ContractPrice:0.099,escalationRate:2,srecTreatment:'Offtaker Retains',avoidedCostKwh:0.086,yieldKwhKwp:1578,energyGenYear1Mwh:3618,systemType:'F',annualSavings:0,paybackYears:0,milestones:STANDARD_MILESTONES},
  {projectNumber:'21460-FL-0007',name:'AdventHealth Waterman',address:'1000 Waterman Way',city:'Tavares',state:'FL',zip:'32778',stage:'Prospecting',dealHealth:'TBD',systemKwdc:1231.2,systemKwac:1000,annualProductionKwh:2009688,utility:'SECO Energy',rateSchedule:'GSD',rateScheduleType:'Non-TOU',annualUsageKwh:22440000,peakDemandKw:0,ahj:'City of Tavares',region:'Florida — Central',tranche:'TR04 - EFD',lat:28.8,lng:-81.65,facilityType:'Acute Care Center',siteType:'Healthcare / Hospital',siteAcres:0,roofType:'N/A',modules:'TBD',inverters:'TBD',monitoring:'TBD',azimuth:'TBD',tilt:'TBD',startDate:'2025-06-01',targetCOD:'TBD',totalCost:2954880,itcEligibleCosts:2443932,itcIneligibleCosts:510948,estimatedEpcCost:2462400,estimatedDevCosts:30780,estimatedIxCosts:0,developmentFee:461700,itcRate:30,domesticContentAssumed:false,safeHarborRequired:false,otherIncentivesTotal:0,incentiveType:'None',contractType:'Energy Services Agreement',revenueType:'Fixed Rate with Escalator',offtakerCredit:'AA - IG',termMonths:360,year1ContractPrice:0.103,escalationRate:2,srecTreatment:'Offtaker Retains',avoidedCostKwh:0.081,yieldKwhKwp:1638,energyGenYear1Mwh:2016,systemType:'F',annualSavings:0,paybackYears:0,milestones:STANDARD_MILESTONES},
  {projectNumber:'21460-FL-0014',name:'AdventHealth Wesley Chapel',address:'2600 Bruce B Downs Blvd',city:'Wesley Chapel',state:'FL',zip:'33544',stage:'Prospecting',dealHealth:'TBD',systemKwdc:2337,systemKwac:1913,annualProductionKwh:3703479,utility:'Withlacoochee River Electric Cooperative',rateSchedule:'GSD',rateScheduleType:'Non-TOU',annualUsageKwh:19819222,peakDemandKw:0,ahj:'Pasco County',region:'Florida — Central West',tranche:'TR02 - WFD',lat:28.35,lng:-82.3667,facilityType:'Acute Care Center',siteType:'Healthcare / Hospital',siteAcres:0,roofType:'N/A',modules:'TBD',inverters:'TBD',monitoring:'TBD',azimuth:'TBD',tilt:'TBD',startDate:'2025-06-01',targetCOD:'TBD',totalCost:7593950,itcEligibleCosts:6607905,itcIneligibleCosts:986045,estimatedEpcCost:6659310,estimatedDevCosts:81781,estimatedIxCosts:0,developmentFee:852859,itcRate:30,domesticContentAssumed:false,safeHarborRequired:true,otherIncentivesTotal:0,incentiveType:'None',contractType:'Energy Services Agreement',revenueType:'Fixed Rate with Escalator',offtakerCredit:'AA - IG',termMonths:360,year1ContractPrice:0.139,escalationRate:2,srecTreatment:'Offtaker Retains',avoidedCostKwh:0.086,yieldKwhKwp:1589,energyGenYear1Mwh:3714,systemType:'CS',annualSavings:0,paybackYears:0,milestones:STANDARD_MILESTONES},
  {projectNumber:'21460-FL-0001',name:'AdventHealth Apopka',address:'2100 Ocoee Apopka Rd',city:'Apopka',state:'FL',zip:'32703',stage:'Prospecting',dealHealth:'TBD',systemKwdc:5780.16,systemKwac:4000,annualProductionKwh:0,utility:'Duke Energy',rateSchedule:'GSDT-1',rateScheduleType:'TOU',annualUsageKwh:13360000,peakDemandKw:0,ahj:'City of Apopka',region:'Florida — Central',tranche:'TR03 - CFD',lat:28.6833,lng:-81.5167,facilityType:'Acute Care Center',siteType:'Healthcare / Hospital',siteAcres:0,roofType:'N/A',modules:'TBD',inverters:'TBD',monitoring:'TBD',azimuth:'TBD',tilt:'TBD',startDate:'2025-06-01',targetCOD:'TBD',totalCost:12141608,itcEligibleCosts:9779754,itcIneligibleCosts:2361854,estimatedEpcCost:9713924,estimatedDevCosts:144504,estimatedIxCosts:115604,developmentFee:2167576,itcRate:30,domesticContentAssumed:false,safeHarborRequired:true,otherIncentivesTotal:0,incentiveType:'None',contractType:'Energy Services Agreement',revenueType:'Fixed Rate with Escalator',offtakerCredit:'AA - IG',termMonths:360,year1ContractPrice:0.083,escalationRate:2,srecTreatment:'Offtaker Retains',avoidedCostKwh:0.0816,yieldKwhKwp:1811,energyGenYear1Mwh:10471,systemType:'GST',annualSavings:0,paybackYears:0,milestones:STANDARD_MILESTONES},
  {projectNumber:'21460-FL-0015',name:'AdventHealth DeLand',address:'701 W Plymouth Ave',city:'DeLand',state:'FL',zip:'32720',stage:'Prospecting',dealHealth:'TBD',systemKwdc:2903.04,systemKwac:2000,annualProductionKwh:5174088,utility:'Duke Energy',rateSchedule:'GSDT-1',rateScheduleType:'TOU',annualUsageKwh:10870000,peakDemandKw:0,ahj:'City of DeLand',region:'Florida — East Central',tranche:'TR04 - EFD',lat:29.0333,lng:-81.3,facilityType:'Acute Care Center',siteType:'Healthcare / Hospital',siteAcres:0,roofType:'N/A',modules:'TBD',inverters:'TBD',monitoring:'TBD',azimuth:'TBD',tilt:'TBD',startDate:'2025-06-01',targetCOD:'TBD',totalCost:6333475,itcEligibleCosts:5170420,itcIneligibleCosts:1163055,estimatedEpcCost:5172259,estimatedDevCosts:101606,estimatedIxCosts:0,developmentFee:1059610,itcRate:30,domesticContentAssumed:false,safeHarborRequired:true,otherIncentivesTotal:0,incentiveType:'None',contractType:'Energy Services Agreement',revenueType:'Fixed Rate with Escalator',offtakerCredit:'AA - IG',termMonths:360,year1ContractPrice:0.086,escalationRate:2,srecTreatment:'Offtaker Retains',avoidedCostKwh:0.0826,yieldKwhKwp:1787,energyGenYear1Mwh:5186,systemType:'GST',annualSavings:0,paybackYears:0,milestones:STANDARD_MILESTONES},
  {projectNumber:'21460-FL-0012',name:'AdventHealth Palm Coast',address:'60 Memorial Medical Pkwy',city:'Palm Coast',state:'FL',zip:'32164',stage:'Prospecting',dealHealth:'TBD',systemKwdc:2903.04,systemKwac:2000,annualProductionKwh:5244342,utility:'Florida Power & Light',rateSchedule:'GSLDT-1',rateScheduleType:'TOU',annualUsageKwh:10720000,peakDemandKw:0,ahj:'City of Palm Coast',region:'Florida — Northeast',tranche:'TR04 - EFD',lat:29.55,lng:-81.2,facilityType:'Acute Care Center',siteType:'Healthcare / Hospital',siteAcres:0,roofType:'N/A',modules:'TBD',inverters:'TBD',monitoring:'TBD',azimuth:'TBD',tilt:'TBD',startDate:'2025-06-01',targetCOD:'TBD',totalCost:6684749,itcEligibleCosts:5514669,itcIneligibleCosts:1170080,estimatedEpcCost:5523533,estimatedDevCosts:101606,estimatedIxCosts:0,developmentFee:1059610,itcRate:30,domesticContentAssumed:false,safeHarborRequired:true,otherIncentivesTotal:0,incentiveType:'None',contractType:'Energy Services Agreement',revenueType:'Fixed Rate with Escalator',offtakerCredit:'AA - IG',termMonths:360,year1ContractPrice:0.089,escalationRate:2,srecTreatment:'Offtaker Retains',avoidedCostKwh:0.0602,yieldKwhKwp:1810,energyGenYear1Mwh:5255,systemType:'GST',annualSavings:0,paybackYears:0,milestones:STANDARD_MILESTONES},
  {projectNumber:'21460-FL-0005',name:'AdventHealth Tampa',address:'3100 E Fletcher Ave',city:'Tampa',state:'FL',zip:'33613',stage:'Prospecting',dealHealth:'TBD',systemKwdc:2216,systemKwac:1625,annualProductionKwh:3536298,utility:'Tampa Electric Company',rateSchedule:'GSD',rateScheduleType:'Non-TOU',annualUsageKwh:1960000,peakDemandKw:0,ahj:'Hillsborough County',region:'Florida — Central West',tranche:'TR02 - WFD',lat:28.05,lng:-82.45,facilityType:'Acute Care Center',siteType:'Healthcare / Hospital',siteAcres:0,roofType:'N/A',modules:'TBD',inverters:'TBD',monitoring:'TBD',azimuth:'TBD',tilt:'TBD',startDate:'2025-06-01',targetCOD:'TBD',totalCost:7302379,itcEligibleCosts:6365813,itcIneligibleCosts:936566,estimatedEpcCost:6382656,estimatedDevCosts:77567,estimatedIxCosts:33243,developmentFee:808913,itcRate:30,domesticContentAssumed:false,safeHarborRequired:true,otherIncentivesTotal:0,incentiveType:'None',contractType:'Energy Services Agreement',revenueType:'Fixed Rate with Escalator',offtakerCredit:'AA - IG',termMonths:360,year1ContractPrice:0.14,escalationRate:2,srecTreatment:'Offtaker Retains',avoidedCostKwh:0.0935,yieldKwhKwp:1596,energyGenYear1Mwh:3536,systemType:'CS',annualSavings:0,paybackYears:0,milestones:STANDARD_MILESTONES},
  {projectNumber:'21460-FL-0004',name:'AdventHealth Daytona Beach',address:'301 Memorial Medical Pkwy',city:'Daytona Beach',state:'FL',zip:'32117',stage:'Prospecting',dealHealth:'TBD',systemKwdc:3060.7,systemKwac:2500,annualProductionKwh:4730037,utility:'Florida Power & Light',rateSchedule:'GSDT-1',rateScheduleType:'TOU',annualUsageKwh:1320000,peakDemandKw:0,ahj:'City of Daytona Beach',region:'Florida — Northeast',tranche:'TR04 - EFD',lat:29.1833,lng:-81.0167,facilityType:'Acute Care Center',siteType:'Healthcare / Hospital',siteAcres:0,roofType:'N/A',modules:'TBD',inverters:'TBD',monitoring:'TBD',azimuth:'TBD',tilt:'TBD',startDate:'2025-06-01',targetCOD:'TBD',totalCost:6794754,itcEligibleCosts:5489672,itcIneligibleCosts:1305082,estimatedEpcCost:5570474,estimatedDevCosts:30607,estimatedIxCosts:0,developmentFee:1193673,itcRate:30,domesticContentAssumed:false,safeHarborRequired:true,otherIncentivesTotal:0,incentiveType:'None',contractType:'Energy Services Agreement',revenueType:'Fixed Rate with Escalator',offtakerCredit:'AA - IG',termMonths:360,year1ContractPrice:0.102,escalationRate:2,srecTreatment:'Offtaker Retains',avoidedCostKwh:0.066,yieldKwhKwp:1547,energyGenYear1Mwh:4734,systemType:'F',annualSavings:0,paybackYears:0,milestones:STANDARD_MILESTONES},
  {projectNumber:'21460-FL-0008',name:'AdventHealth East Orlando',address:'7727 Lake Underhill Rd',city:'Orlando',state:'FL',zip:'32822',stage:'Prospecting',dealHealth:'TBD',systemKwdc:1110.24,systemKwac:1063,annualProductionKwh:2111369,utility:'Duke Energy Florida',rateSchedule:'GS-1',rateScheduleType:'TOU',annualUsageKwh:9920000,peakDemandKw:0,ahj:'Orange County',region:'Florida — Central',tranche:'TR03 - CFD',lat:28.5,lng:-81.3333,facilityType:'Acute Care Center',siteType:'Healthcare / Hospital',siteAcres:0,roofType:'N/A',modules:'TBD',inverters:'TBD',monitoring:'TBD',azimuth:'TBD',tilt:'TBD',startDate:'2025-06-01',targetCOD:'TBD',totalCost:3131154,itcEligibleCosts:2599508,itcIneligibleCosts:531646,estimatedEpcCost:2595914,estimatedDevCosts:55512,estimatedIxCosts:0,developmentFee:479728,itcRate:30,domesticContentAssumed:false,safeHarborRequired:false,otherIncentivesTotal:0,incentiveType:'None',contractType:'Energy Services Agreement',revenueType:'Fixed Rate with Escalator',offtakerCredit:'AA - IG',termMonths:360,year1ContractPrice:0.104,escalationRate:2,srecTreatment:'Offtaker Retains',avoidedCostKwh:0.098,yieldKwhKwp:1909,energyGenYear1Mwh:2119,systemType:'R-F',annualSavings:0,paybackYears:0,milestones:STANDARD_MILESTONES},
  {projectNumber:'21460-FL-0010',name:'AdventHealth Fish Memorial',address:'1055 Saxon Blvd',city:'Orange City',state:'FL',zip:'32763',stage:'Prospecting',dealHealth:'TBD',systemKwdc:1944.0,systemKwac:1350,annualProductionKwh:3471984,utility:'Duke Energy',rateSchedule:'GSDT-1',rateScheduleType:'TOU',annualUsageKwh:12890000,peakDemandKw:0,ahj:'City of Orange City',region:'Florida — East Central',tranche:'TR04 - EFD',lat:28.9167,lng:-81.2833,facilityType:'Acute Care Center',siteType:'Healthcare / Hospital',siteAcres:0,roofType:'N/A',modules:'TBD',inverters:'TBD',monitoring:'TBD',azimuth:'TBD',tilt:'TBD',startDate:'2025-06-01',targetCOD:'TBD',totalCost:4354560,itcEligibleCosts:3573461,itcIneligibleCosts:781099,estimatedEpcCost:3576960,estimatedDevCosts:68040,estimatedIxCosts:0,developmentFee:709560,itcRate:30,domesticContentAssumed:false,safeHarborRequired:false,otherIncentivesTotal:0,incentiveType:'None',contractType:'Energy Services Agreement',revenueType:'Fixed Rate with Escalator',offtakerCredit:'AA - IG',termMonths:360,year1ContractPrice:0.088,escalationRate:2,srecTreatment:'Offtaker Retains',avoidedCostKwh:0.0876,yieldKwhKwp:1791,energyGenYear1Mwh:3482,systemType:'GST',annualSavings:0,paybackYears:0,milestones:STANDARD_MILESTONES},
  {projectNumber:'21460-FL-0017',name:'AdventHealth Winter Garden',address:'2000 Fowler Grove Blvd',city:'Winter Garden',state:'FL',zip:'34787',stage:'Prospecting',dealHealth:'TBD',systemKwdc:3413.34,systemKwac:2700,annualProductionKwh:5386251,utility:'Duke Energy',rateSchedule:'GSDT-1',rateScheduleType:'TOU',annualUsageKwh:9430000,peakDemandKw:0,ahj:'City of Winter Garden',region:'Florida — Central',tranche:'TR03 - CFD',lat:28.5667,lng:-81.5833,facilityType:'Acute Care Center',siteType:'Healthcare / Hospital',siteAcres:0,roofType:'N/A',modules:'TBD',inverters:'TBD',monitoring:'TBD',azimuth:'TBD',tilt:'TBD',startDate:'2025-06-01',targetCOD:'TBD',totalCost:8188191,itcEligibleCosts:6790179,itcIneligibleCosts:1398012,estimatedEpcCost:6754605,estimatedDevCosts:102400,estimatedIxCosts:68266,developmentFee:1262920,itcRate:30,domesticContentAssumed:false,safeHarborRequired:true,otherIncentivesTotal:0,incentiveType:'None',contractType:'Energy Services Agreement',revenueType:'Fixed Rate with Escalator',offtakerCredit:'AA - IG',termMonths:360,year1ContractPrice:0.109,escalationRate:2,srecTreatment:'Offtaker Retains',avoidedCostKwh:0.0761,yieldKwhKwp:1584,energyGenYear1Mwh:5405,systemType:'F',annualSavings:0,paybackYears:0,milestones:STANDARD_MILESTONES},
  {projectNumber:'21460-IL-0006',name:'UChicago Medicine Hinsdale',address:'1 Salt Creek Ln',city:'Hinsdale',state:'IL',zip:'60521',stage:'Prospecting',dealHealth:'TBD',systemKwdc:1057,systemKwac:875,annualProductionKwh:0,utility:'Commonwealth Edison',rateSchedule:'Large Load',rateScheduleType:'Non-TOU',annualUsageKwh:2370000,peakDemandKw:0,ahj:'Village of Hinsdale',region:'Illinois — Chicagoland',tranche:'TR01 - GLR',lat:41.8,lng:-87.95,facilityType:'Acute Care Center',siteType:'Healthcare / Hospital',siteAcres:0,roofType:'N/A',modules:'TBD',inverters:'TBD',monitoring:'TBD',azimuth:'TBD',tilt:'TBD',startDate:'2025-06-01',targetCOD:'TBD',totalCost:0,itcEligibleCosts:0,itcIneligibleCosts:0,estimatedEpcCost:0,estimatedDevCosts:0,estimatedIxCosts:0,developmentFee:0,itcRate:30,domesticContentAssumed:false,safeHarborRequired:false,otherIncentivesTotal:0,incentiveType:'None',contractType:'Energy Services Agreement',revenueType:'Fixed Rate with Escalator',offtakerCredit:'AA - IG',termMonths:360,year1ContractPrice:0,escalationRate:2,srecTreatment:'Offtaker Retains',avoidedCostKwh:0,yieldKwhKwp:0,energyGenYear1Mwh:0,systemType:'',annualSavings:0,paybackYears:0,milestones:STANDARD_MILESTONES},
  {projectNumber:'21460-IL-0003',name:'AdventHealth Hinsdale',address:'120 N Oak St',city:'Hinsdale',state:'IL',zip:'60521',stage:'Prospecting',dealHealth:'TBD',systemKwdc:820,systemKwac:688,annualProductionKwh:996816,utility:'Commonwealth Edison',rateSchedule:'Large Load',rateScheduleType:'Non-TOU',annualUsageKwh:6156064,peakDemandKw:0,ahj:'Village of Hinsdale',region:'Illinois — Chicagoland',tranche:'TR01 - GLR',lat:41.8,lng:-87.95,facilityType:'Offsite Medical Center',siteType:'Healthcare / Hospital',siteAcres:0,roofType:'N/A',modules:'TBD',inverters:'TBD',monitoring:'TBD',azimuth:'TBD',tilt:'TBD',startDate:'2025-06-01',targetCOD:'TBD',totalCost:2672222,itcEligibleCosts:2378769,itcIneligibleCosts:293453,estimatedEpcCost:2377130,estimatedDevCosts:40985,estimatedIxCosts:8197,developmentFee:245910,itcRate:30,domesticContentAssumed:false,safeHarborRequired:false,otherIncentivesTotal:779665,incentiveType:'State',contractType:'Power Purchase Agreement',revenueType:'Fixed Rate with Escalator',offtakerCredit:'AA - IG',termMonths:360,year1ContractPrice:0.129,escalationRate:2,srecTreatment:'REC Arbitrage',avoidedCostKwh:0.077,yieldKwhKwp:1216,energyGenYear1Mwh:997,systemType:'CG',annualSavings:0,paybackYears:0,milestones:STANDARD_MILESTONES},
  {projectNumber:'21460-IL-0010',name:'Adventist LaGrange',address:'5101 Willow Springs Rd',city:'La Grange',state:'IL',zip:'60525',stage:'Prospecting',dealHealth:'TBD',systemKwdc:2730,systemKwac:2163,annualProductionKwh:3439185,utility:'Commonwealth Edison',rateSchedule:'Very Large Load',rateScheduleType:'Non-TOU',annualUsageKwh:9417806,peakDemandKw:0,ahj:'Village of La Grange',region:'Illinois — Chicagoland',tranche:'TR01 - GLR',lat:41.8167,lng:-87.8833,facilityType:'Acute Care Center',siteType:'Healthcare / Hospital',siteAcres:0,roofType:'N/A',modules:'TBD',inverters:'TBD',monitoring:'TBD',azimuth:'TBD',tilt:'TBD',startDate:'2025-06-01',targetCOD:'TBD',totalCost:7425600,itcEligibleCosts:6614800,itcIneligibleCosts:810800,estimatedEpcCost:6415500,estimatedDevCosts:136510,estimatedIxCosts:191100,developmentFee:682490,itcRate:30,domesticContentAssumed:false,safeHarborRequired:true,otherIncentivesTotal:2631815,incentiveType:'State',contractType:'Power Purchase Agreement',revenueType:'Fixed Rate with Escalator',offtakerCredit:'AA - IG',termMonths:360,year1ContractPrice:0.084,escalationRate:2,srecTreatment:'REC Arbitrage',avoidedCostKwh:0.072,yieldKwhKwp:1260,energyGenYear1Mwh:3439,systemType:'CS',annualSavings:0,paybackYears:0,milestones:STANDARD_MILESTONES},
  {projectNumber:'21460-IL-0002',name:'Adventist GlenOaks',address:'701 Winthrop Ave',city:'Glendale Heights',state:'IL',zip:'60139',stage:'Prospecting',dealHealth:'TBD',systemKwdc:1190,systemKwac:925,annualProductionKwh:1493833,utility:'Commonwealth Edison',rateSchedule:'Large Load',rateScheduleType:'Non-TOU',annualUsageKwh:5320250,peakDemandKw:0,ahj:'Village of Glendale Heights',region:'Illinois — Chicagoland',tranche:'TR01 - GLR',lat:41.9,lng:-88.0167,facilityType:'Acute Care Center',siteType:'Healthcare / Hospital',siteAcres:0,roofType:'N/A',modules:'TBD',inverters:'TBD',monitoring:'TBD',azimuth:'TBD',tilt:'TBD',startDate:'2025-06-01',targetCOD:'TBD',totalCost:3455788,itcEligibleCosts:3114373,itcIneligibleCosts:341415,estimatedEpcCost:3092960,estimatedDevCosts:77324,estimatedIxCosts:5948,developmentFee:279556,itcRate:30,domesticContentAssumed:false,safeHarborRequired:false,otherIncentivesTotal:1138267,incentiveType:'State',contractType:'Power Purchase Agreement',revenueType:'Fixed Rate with Escalator',offtakerCredit:'AA - IG',termMonths:360,year1ContractPrice:0.089,escalationRate:2,srecTreatment:'REC Arbitrage',avoidedCostKwh:0.069,yieldKwhKwp:1256,energyGenYear1Mwh:1494,systemType:'CS/R',annualSavings:0,paybackYears:0,milestones:STANDARD_MILESTONES},
  {projectNumber:'21460-IL-0001',name:'Adventist Bolingbrook',address:'500 Remington Blvd',city:'Bolingbrook',state:'IL',zip:'60440',stage:'Prospecting',dealHealth:'TBD',systemKwdc:2359,systemKwac:1750,annualProductionKwh:3513338,utility:'Commonwealth Edison',rateSchedule:'Very Large Load',rateScheduleType:'Non-TOU',annualUsageKwh:8100000,peakDemandKw:0,ahj:'Will County',region:'Illinois — Chicagoland',tranche:'TR01 - GLR',lat:41.7333,lng:-88.0667,facilityType:'Acute Care Center',siteType:'Healthcare / Hospital',siteAcres:0,roofType:'N/A',modules:'TBD',inverters:'TBD',monitoring:'TBD',azimuth:'TBD',tilt:'TBD',startDate:'2025-06-01',targetCOD:'TBD',totalCost:5825989,itcEligibleCosts:4674473,itcIneligibleCosts:1151516,estimatedEpcCost:4505117,estimatedDevCosts:117936,estimatedIxCosts:141522,developmentFee:1061414,itcRate:30,domesticContentAssumed:false,safeHarborRequired:true,otherIncentivesTotal:2271680,incentiveType:'State',contractType:'Power Purchase Agreement',revenueType:'Fixed Rate with Escalator',offtakerCredit:'AA - IG',termMonths:360,year1ContractPrice:0.059,escalationRate:2,srecTreatment:'REC Arbitrage',avoidedCostKwh:0.062,yieldKwhKwp:1490,energyGenYear1Mwh:3513,systemType:'GST',annualSavings:0,paybackYears:0,milestones:STANDARD_MILESTONES},
  {projectNumber:'21460-FL-0018',name:'AdventHealth Consolidated Services Center',address:'TBD',city:'Altamonte Springs',state:'FL',zip:'32714',stage:'Prospecting',dealHealth:'TBD',systemKwdc:542.0,systemKwac:400,annualProductionKwh:0,utility:'Duke Energy',rateSchedule:'TBD',rateScheduleType:'Non-TOU',annualUsageKwh:0,peakDemandKw:0,ahj:'Seminole County',region:'Florida — Central',tranche:'TR05 - CORP',lat:28.6611,lng:-81.3656,facilityType:'Distribution Center',siteType:'Healthcare / Corporate',siteAcres:0,roofType:'N/A',modules:'TBD',inverters:'TBD',monitoring:'TBD',azimuth:'TBD',tilt:'TBD',startDate:'2025-06-01',targetCOD:'TBD',totalCost:1438800,itcEligibleCosts:1192400,itcIneligibleCosts:0,estimatedEpcCost:1192400,estimatedDevCosts:0,estimatedIxCosts:2500,developmentFee:243900,itcRate:30,domesticContentAssumed:false,safeHarborRequired:true,otherIncentivesTotal:0,incentiveType:'None',contractType:'Energy Services Agreement',revenueType:'Fixed Rate with Escalator',offtakerCredit:'AA - IG',termMonths:360,year1ContractPrice:0.103,escalationRate:2,srecTreatment:'Offtaker Retains',avoidedCostKwh:0.1011,yieldKwhKwp:1632,energyGenYear1Mwh:885,systemType:'R',annualSavings:0,paybackYears:0,milestones:[{label:'Site Assessment Complete',date:'2025-06-01',done:false},{label:'Feasibility Report Delivered',date:'2025-07-16',done:false},{label:'PPA / Contract Executed',date:'2025-08-30',done:false},{label:'Interconnection Application Filed',date:'2025-09-29',done:false},{label:'Engineering Design Approved',date:'2025-10-29',done:false},{label:'Permit Submitted',date:'2025-11-28',done:false},{label:'Permit Approved',date:'2025-12-28',done:false},{label:'Equipment Procurement',date:'2026-01-27',done:false},{label:'Construction Start',date:'2026-02-26',done:false},{label:'Substantial Completion',date:'2026-04-27',done:false},{label:'Interconnection Approved',date:'2026-05-17',done:false},{label:'PTO / Commercial Operation',date:'2026-06-01',done:false}]},
]

// Stakeholder data — project index matches prototype (index 0 = first project in PROJECTS array)
interface StakeholderData {
  projectNumber: string | null
  name: string; title: string; department: string; role: string
  email: string; phone: string; sentiment: string; isPrimary: boolean; org: string
}

const STAKEHOLDERS: StakeholderData[] = [
  {projectNumber:null,name:'Morgan Brawner',title:'Project Developer',department:'Development',role:'Project Manager',email:'mbrawner@esa-solar.com',phone:'TBD',sentiment:'Supportive',isPrimary:true,org:'ESA Solar'},
  {projectNumber:'21460-FL-0008',name:'Scott Sukits',title:'Regional Director Facilities/Engineering, Control Systems & Energy Mgmt',department:'Facilities',role:'Evaluator',email:'scott.sukits@adventhealth.com',phone:'TBD',sentiment:'Supportive',isPrimary:false,org:'AdventHealth'},
  {projectNumber:'21460-FL-0008',name:'Ben Dale',title:'Director of Operations',department:'Operations',role:'Evaluator',email:'ben.dale@adventhealth.com',phone:'TBD',sentiment:'Supportive',isPrimary:false,org:'AdventHealth'},
  {projectNumber:'21460-FL-0008',name:'Deanna Peter',title:'HR Director',department:'HR/Administrative',role:'Influencer',email:'deeana.peter@adventhealth.com',phone:'TBD',sentiment:'Neutral',isPrimary:false,org:'AdventHealth'},
  {projectNumber:'21460-FL-0008',name:'Kirstie Questell',title:'Chief Financial Officer',department:'Finance',role:'Evaluator',email:'kirstie.questell@adventhealth.com',phone:'TBD',sentiment:'Neutral',isPrimary:false,org:'AdventHealth'},
  {projectNumber:'21460-FL-0015',name:'Jeffery Bates',title:'Executive Director of Facilities',department:'Facilities',role:'Decision Maker',email:'jeffery.bates@adventhealth.com',phone:'TBD',sentiment:'Supportive',isPrimary:true,org:'AdventHealth'},
  {projectNumber:'21460-FL-0015',name:'Anwar Bowes',title:'Director of Operations',department:'Operations',role:'Evaluator',email:'anwar.bowes@adventhealth.com',phone:'TBD',sentiment:'Supportive',isPrimary:false,org:'AdventHealth'},
  {projectNumber:'21460-FL-0015',name:'Tim Williams',title:'Chief Operating Officer',department:'Operations',role:'Decision Maker',email:'tim.williams@adventhealth.com',phone:'TBD',sentiment:'Neutral',isPrimary:true,org:'AdventHealth'},
  {projectNumber:'21460-FL-0012',name:'Mark Rathbun',title:'Chief Financial Officer',department:'Finance',role:'Evaluator',email:'mark.rathbun@adventhealth.com',phone:'TBD',sentiment:'Supportive',isPrimary:false,org:'AdventHealth'},
  {projectNumber:'21460-FL-0012',name:'Jefferson Santos',title:'Director of Operations',department:'Operations',role:'Evaluator',email:'jefferson.santos@adventhealth.com',phone:'TBD',sentiment:'Supportive',isPrimary:false,org:'AdventHealth'},
  {projectNumber:'21460-FL-0012',name:'Clifton Scott',title:'Chief Operating Officer',department:'Operations',role:'Decision Maker',email:'clifton.scott@adventhealth.com',phone:'TBD',sentiment:'Supportive',isPrimary:true,org:'AdventHealth'},
  {projectNumber:'21460-FL-0012',name:'John Newman',title:'Executive Director of Facilities',department:'Facilities',role:'Evaluator',email:'john.c.newman@adventhealth.com',phone:'TBD',sentiment:'Supportive',isPrimary:false,org:'AdventHealth'},
  {projectNumber:'21460-FL-0012',name:'Wally Deaquino',title:'Chief Executive Officer',department:'Operations',role:'Decision Maker',email:'wally.deaquino@adventhealth.com',phone:'TBD',sentiment:'Supportive',isPrimary:true,org:'AdventHealth'},
  {projectNumber:'21460-FL-0009',name:'Jacob Cook',title:'Chief Operating Officer',department:'Operations',role:'Decision Maker',email:'jacob.cook@adventhealth.com',phone:'TBD',sentiment:'Supportive',isPrimary:true,org:'AdventHealth'},
  {projectNumber:'21460-FL-0009',name:'Rebecca Mcintyre',title:'Director of Ancillary Services',department:'Operations',role:'Evaluator',email:'rebecca.mcintyre@adventhealth.com',phone:'TBD',sentiment:'Supportive',isPrimary:false,org:'AdventHealth'},
  {projectNumber:'21460-FL-0009',name:'Michael Prentice',title:'Director Global Supply Chain',department:'Operations',role:'Evaluator',email:'michael.prentice@adventhealth.com',phone:'TBD',sentiment:'Supportive',isPrimary:false,org:'AdventHealth'},
  {projectNumber:'21460-FL-0009',name:'Jeff Chilson',title:'Chief Financial Officer',department:'Finance',role:'Evaluator',email:'jeff.chilson@adventhealth.com',phone:'TBD',sentiment:'Supportive',isPrimary:false,org:'AdventHealth'},
  {projectNumber:'21460-FL-0004',name:'Lisa Kelley',title:'Director of Performance Excellence',department:'Operations',role:'Evaluator',email:'lisa.kelley@adventhealth.com',phone:'TBD',sentiment:'Supportive',isPrimary:false,org:'AdventHealth'},
  {projectNumber:'21460-FL-0004',name:'Dawn Richards',title:'Associate VP of Finance',department:'Finance',role:'Evaluator',email:'Dawn.L.Richards@AdventHealth.com',phone:'TBD',sentiment:'Concerned',isPrimary:false,org:'AdventHealth'},
  {projectNumber:'21460-FL-0004',name:'Jocelyn Krise',title:'Executive Director of Rehabilitation',department:'Operations',role:'Influencer',email:'jocelyn.krise@adventhealth.com',phone:'TBD',sentiment:'Supportive',isPrimary:false,org:'AdventHealth'},
  {projectNumber:'21460-FL-0004',name:'David Gordon',title:'Executive Director of Operations',department:'Operations',role:'Evaluator',email:'david.gordon@adventhealth.com',phone:'TBD',sentiment:'Neutral',isPrimary:false,org:'AdventHealth'},
  {projectNumber:'21460-FL-0004',name:'David Musser',title:'Engineering Supervisor',department:'Facilities',role:'Evaluator',email:'david.musser@adventhealth.com',phone:'TBD',sentiment:'Neutral',isPrimary:false,org:'AdventHealth'},
  {projectNumber:'21460-FL-0006',name:'Justin Watson',title:'Director of Operations & COO (acting)',department:'Operations',role:'Decision Maker',email:'justin.watson@adventhealth.com',phone:'TBD',sentiment:'Supportive',isPrimary:true,org:'AdventHealth'},
  {projectNumber:'21460-FL-0006',name:'Christina Miller',title:'Director Institute for Lifestyle Medicine',department:'Facilities',role:'Evaluator',email:'christina.miller6@adventhealth.com',phone:'TBD',sentiment:'Neutral',isPrimary:false,org:'AdventHealth'},
  {projectNumber:'21460-FL-0006',name:'Juan Garcia',title:'Director of Engineering',department:'Facilities',role:'Evaluator',email:'juan.garcia@adventhealth.com',phone:'TBD',sentiment:'Supportive',isPrimary:false,org:'AdventHealth'},
  {projectNumber:'21460-FL-0001',name:'Kevin Poole',title:'Chief Operating Officer',department:'Operations',role:'Decision Maker',email:'kevin.poole@adventhealth.com',phone:'TBD',sentiment:'Supportive',isPrimary:true,org:'AdventHealth'},
  {projectNumber:'21460-FL-0001',name:'Kurt Azevedo',title:'Director of Engineering',department:'Facilities',role:'Evaluator',email:'kurt.azevedo@adventhealth.com',phone:'TBD',sentiment:'Supportive',isPrimary:false,org:'AdventHealth'},
  {projectNumber:'21460-FL-0001',name:'Abigail Shelton',title:'Finance Director',department:'Finance',role:'Evaluator',email:'abigail.shelton@adventhealth.com',phone:'TBD',sentiment:'Supportive',isPrimary:false,org:'AdventHealth'},
  {projectNumber:'21460-FL-0001',name:'Kathleen Gdula',title:'Director of Operations',department:'Operations',role:'Evaluator',email:'kathleen.gdula@adventhealth.com',phone:'TBD',sentiment:'Neutral',isPrimary:false,org:'AdventHealth'},
  {projectNumber:'21460-FL-0007',name:'Jeffrey Brownlow',title:'Executive Director of Operations',department:'Operations',role:'Evaluator',email:'jeffrey.brownlow@adventhealth.com',phone:'TBD',sentiment:'Concerned',isPrimary:false,org:'AdventHealth'},
  {projectNumber:'21460-FL-0007',name:'Joshua Pinion',title:'Director of Facilities',department:'Facilities',role:'Evaluator',email:'joshua.pinion@adventhealth.com',phone:'TBD',sentiment:'Neutral',isPrimary:false,org:'AdventHealth'},
  {projectNumber:'21460-FL-0014',name:'Susan Ward',title:'Supply Chain Director',department:'Operations',role:'Decision Maker',email:'susan.e.ward@adventhealth.com',phone:'TBD',sentiment:'Supportive',isPrimary:true,org:'AdventHealth'},
  {projectNumber:'21460-FL-0014',name:"Nicole O'Keefe",title:'Director of Operations',department:'Operations',role:'Evaluator',email:'nicole.acosta@adventhealth.com',phone:'TBD',sentiment:'Supportive',isPrimary:false,org:'AdventHealth'},
  {projectNumber:'21460-FL-0014',name:'Mark Chapoton',title:'Facilities Engineering Director',department:'Facilities',role:'Evaluator',email:'mark.chapoton@adventhealth.com',phone:'TBD',sentiment:'Supportive',isPrimary:false,org:'AdventHealth'},
  {projectNumber:'21460-FL-0014',name:'Nick Papa',title:'Director for Support Services',department:'Operations',role:'Evaluator',email:'nick.papa@adventhealth.com',phone:'TBD',sentiment:'Supportive',isPrimary:false,org:'AdventHealth'},
  {projectNumber:'21460-FL-0014',name:'Zachary Crane',title:'Chief Operating Officer',department:'Operations',role:'Decision Maker',email:'zachary.crane@adventhealth.com',phone:'TBD',sentiment:'Neutral',isPrimary:true,org:'AdventHealth'},
  {projectNumber:'21460-FL-0005',name:'Douglas Colburn',title:'Chief Operating Officer',department:'Operations',role:'Decision Maker',email:'douglas.colburn@adventhealth.com',phone:'TBD',sentiment:'Supportive',isPrimary:true,org:'AdventHealth'},
  {projectNumber:'21460-FL-0005',name:'John Crouch',title:'Admin Director of Engineering — Sustainability Counsel',department:'Facilities',role:'Evaluator',email:'john.crouch@adventhealth.com',phone:'TBD',sentiment:'Supportive',isPrimary:false,org:'AdventHealth'},
  {projectNumber:'21460-FL-0005',name:'Aaron Patterson',title:'Leadership Resident — Sustainability Counsel',department:'Sustainability',role:'Influencer',email:'aaron.patterson@adventhealth.com',phone:'TBD',sentiment:'Supportive',isPrimary:false,org:'AdventHealth'},
  {projectNumber:'21460-FL-0010',name:'Jeffrey Bates',title:'Executive Director for Engineering & Facilities',department:'Facilities',role:'Decision Maker',email:'jeffery.bates@adventhealth.com',phone:'TBD',sentiment:'Supportive',isPrimary:true,org:'AdventHealth'},
  {projectNumber:'21460-FL-0010',name:'Kenneth Zill',title:'Chief Financial Officer',department:'Finance',role:'Evaluator',email:'kenneth.zill@adventhealth.com',phone:'TBD',sentiment:'Supportive',isPrimary:false,org:'AdventHealth'},
  {projectNumber:'21460-FL-0017',name:'Jake Miller',title:'Director of Operations',department:'Operations',role:'Decision Maker',email:'jake.miller@adventhealth.com',phone:'TBD',sentiment:'Supportive',isPrimary:true,org:'AdventHealth'},
  {projectNumber:'21460-FL-0017',name:'Vincent David',title:'Facilities Manager',department:'Facilities',role:'Influencer',email:'vincent.david@adventhealth.com',phone:'TBD',sentiment:'Supportive',isPrimary:false,org:'AdventHealth'},
]

async function seed() {
  console.log('Seeding Pathwaze database...')

  // Users
  for (const u of USERS) {
    const { error } = await supabase.from('users').upsert(u)
    if (error) console.error('User error:', error.message)
  }
  console.log('Users seeded')

  // Projects
  const projectIdMap: Record<string, string> = {}

  for (const p of PROJECTS) {
    const { data: proj, error } = await supabase.from('projects').upsert({
      project_number: p.projectNumber,
      name: p.name,
      customer: 'AdventHealth',
      stage: p.stage,
      deal_health: p.dealHealth,
      system_kwdc: p.systemKwdc,
      system_kwac: p.systemKwac,
      annual_production_kwh: p.annualProductionKwh,
      address: p.address,
      city: p.city,
      state: p.state,
      zip: p.zip,
      lat: p.lat,
      lng: p.lng,
      utility: p.utility,
      rate_schedule: p.rateSchedule,
      rate_schedule_type: p.rateScheduleType,
      annual_usage_kwh: p.annualUsageKwh,
      peak_demand_kw: p.peakDemandKw,
      ahj: p.ahj,
      region: p.region,
      tranche: p.tranche,
      facility_type: p.facilityType,
      site_type: p.siteType,
      site_acres: p.siteAcres,
      roof_type: p.roofType,
      modules: p.modules,
      inverters: p.inverters,
      monitoring: p.monitoring,
      azimuth: p.azimuth,
      tilt: p.tilt,
      start_date: p.startDate,
      target_cod: p.targetCOD,
      assignee_id: ASSIGNEE_ID,
    }, { onConflict: 'project_number' }).select('id').single()

    if (error) { console.error(`Project error (${p.name}):`, error.message); continue }
    if (!proj) continue

    projectIdMap[p.projectNumber] = proj.id
    console.log(`Project seeded: ${p.name} → ${proj.id}`)

    // Financials
    await supabase.from('project_financials').upsert({
      project_id: proj.id,
      total_cost: p.totalCost,
      itc_eligible_costs: p.itcEligibleCosts,
      itc_ineligible_costs: p.itcIneligibleCosts,
      estimated_epc_cost: p.estimatedEpcCost,
      estimated_dev_costs: p.estimatedDevCosts,
      estimated_ix_costs: p.estimatedIxCosts,
      development_fee: p.developmentFee,
      itc_rate: p.itcRate,
      domestic_content_assumed: p.domesticContentAssumed,
      safe_harbor_required: p.safeHarborRequired,
      other_incentives_total: p.otherIncentivesTotal,
      incentive_type: p.incentiveType,
      contract_type: p.contractType,
      revenue_type: p.revenueType,
      offtaker_credit: p.offtakerCredit,
      term_months: p.termMonths,
      year1_contract_price: p.year1ContractPrice,
      escalation_rate: p.escalationRate,
      srec_treatment: p.srecTreatment,
      avoided_cost_kwh: p.avoidedCostKwh,
      yield_kwh_kwp: p.yieldKwhKwp,
      energy_gen_year1_mwh: p.energyGenYear1Mwh,
      system_type: p.systemType,
      annual_savings: p.annualSavings,
      payback_years: p.paybackYears,
    }, { onConflict: 'project_id' })

    // Milestones
    for (let i = 0; i < p.milestones.length; i++) {
      const m = p.milestones[i]
      await supabase.from('milestones').insert({
        project_id: proj.id,
        label: m.label,
        target_date: m.date,
        completed: m.done,
        sort_order: i,
      })
    }

    // Dataroom docs
    for (const cat of DR_CATEGORIES) {
      for (const sub of cat.subs) {
        for (const doc of sub.docs) {
          await supabase.from('dataroom_docs').upsert({
            project_id: proj.id,
            category_id: cat.id,
            subcategory_id: sub.id,
            doc_name: doc,
            status: 'pending',
          }, { onConflict: 'project_id,category_id,doc_name' })
        }
      }
    }
  }
  console.log('Projects, financials, milestones, and dataroom docs seeded')

  // Stakeholders
  for (const s of STAKEHOLDERS) {
    const projectId = s.projectNumber ? projectIdMap[s.projectNumber] : null
    const { error } = await supabase.from('stakeholders').insert({
      project_id: projectId,
      name: s.name,
      title: s.title,
      department: s.department,
      role: s.role,
      email: s.email,
      phone: s.phone,
      sentiment: s.sentiment,
      is_primary: s.isPrimary,
      org: s.org,
    })
    if (error) console.error(`Stakeholder error (${s.name}):`, error.message)
  }
  console.log('Stakeholders seeded')

  // Tasks
  const taskAssignees: Record<string, string> = {
    'Morgan Brawner': ASSIGNEE_ID,
    'Sarah Chen': SARAH_ID,
    'James Wright': JAMES_ID,
  }

  const taskProjectNumbers: Record<number, string> = {
    1: '21460-FL-0011', 2: '21460-FL-0009', 3: '21460-FL-0006', 4: '21460-FL-0007',
    5: '21460-FL-0014', 6: '21460-FL-0001', 7: '21460-FL-0015', 8: '21460-FL-0012',
    9: '21460-FL-0005', 10: '21460-FL-0004', 11: '21460-FL-0008', 12: '21460-FL-0010',
    13: '21460-FL-0017', 14: '21460-IL-0006', 15: '21460-IL-0003', 16: '21460-IL-0010',
    17: '21460-IL-0002', 18: '21460-IL-0001', 19: '21460-FL-0018'
  }

  const taskData = [
    {projectIdx:15,title:'Finalize Interconnection Application',type:'Interconnection',status:'In Progress',priority:'High',description:'Complete and submit ComEd interconnection application for Bolingbrook.',assignee:'Morgan Brawner',approver:'Sarah Chen',requiresApproval:true,approvalStatus:'Pending',dueDate:'2026-04-25'},
    {projectIdx:16,title:'Submit Building Permit Package',type:'Permitting',status:'Ready to Start',priority:'High',description:'Compile full permit package for La Grange.',assignee:'James Wright',approver:'Morgan Brawner',requiresApproval:true,approvalStatus:'Pending',dueDate:'2026-05-01'},
    {projectIdx:17,title:'Complete Phase 1 ESA Report',type:'Legal',status:'Under Review',priority:'Medium',description:'Environmental site assessment for Hinsdale.',assignee:'Sarah Chen',approver:'Morgan Brawner',requiresApproval:true,approvalStatus:'Pending',dueDate:'2026-04-18'},
    {projectIdx:18,title:'Update Financial Model — GlenOaks',type:'Financial',status:'Complete',priority:'Medium',description:'Refresh proforma with final EPC pricing.',assignee:'Morgan Brawner',approver:null,requiresApproval:false,approvalStatus:null,dueDate:'2026-03-20'},
    {projectIdx:15,title:'Structural Engineering Review',type:'Engineering',status:'Pending Info',priority:'High',description:'Awaiting roof load analysis for Bolingbrook carport design.',assignee:'James Wright',approver:null,requiresApproval:false,approvalStatus:null,dueDate:'2026-04-30'},
    {projectIdx:1,title:'Duke Energy IX Pre-Application Meeting',type:'Interconnection',status:'Ready to Start',priority:'Medium',description:'Schedule and attend pre-application meeting with Duke Energy for Zephyrhills.',assignee:'Morgan Brawner',approver:null,requiresApproval:false,approvalStatus:null,dueDate:'2026-05-10'},
    {projectIdx:2,title:'Survey & Title Report — Sebring',type:'Legal',status:'In Progress',priority:'Medium',description:'Order ALTA survey and title report for Sebring campus.',assignee:'Sarah Chen',approver:null,requiresApproval:false,approvalStatus:null,dueDate:'2026-05-05'},
    {projectIdx:5,title:'Negotiate Roof Lease Agreement — Wesley Chapel',type:'Legal',status:'Draft',priority:'High',description:'Draft and negotiate rooftop lease/license agreement for Wesley Chapel.',assignee:'Sarah Chen',approver:'Morgan Brawner',requiresApproval:true,approvalStatus:'Pending',dueDate:'2026-05-15'},
    {projectIdx:9,title:'TECO Interconnection Feasibility Study',type:'Interconnection',status:'In Progress',priority:'High',description:'Follow up with Tampa Electric on interconnection feasibility study results.',assignee:'Morgan Brawner',approver:null,requiresApproval:false,approvalStatus:null,dueDate:'2026-04-28'},
    {projectIdx:3,title:'Site Assessment Report — Celebration',type:'Engineering',status:'Complete',priority:'Low',description:'Complete site assessment for Celebration campus.',assignee:'James Wright',approver:null,requiresApproval:false,approvalStatus:null,dueDate:'2026-03-15'},
    {projectIdx:6,title:'Preliminary Design Package — Apopka',type:'Design',status:'In Progress',priority:'High',description:'Develop 30% design package for Apopka GST system.',assignee:'James Wright',approver:'Morgan Brawner',requiresApproval:true,approvalStatus:'Pending',dueDate:'2026-05-01'},
    {projectIdx:11,title:'Electrical Permit Pre-Review — East Orlando',type:'Permitting',status:'Pending Info',priority:'Medium',description:'Submit preliminary electrical plans to Orange County for pre-review.',assignee:'James Wright',approver:null,requiresApproval:false,approvalStatus:null,dueDate:'2026-05-20'},
    {projectIdx:13,title:'Update Proforma — Winter Garden',type:'Financial',status:'Ready to Start',priority:'Medium',description:'Update financial model with revised EPC pricing for Winter Garden.',assignee:'Morgan Brawner',approver:null,requiresApproval:false,approvalStatus:null,dueDate:'2026-04-22'},
    {projectIdx:4,title:'SECO Energy Net Metering Application — Waterman',type:'Interconnection',status:'Draft',priority:'Medium',description:'Prepare and submit net metering application to SECO Energy for Waterman.',assignee:'Morgan Brawner',approver:null,requiresApproval:false,approvalStatus:null,dueDate:'2026-05-30'},
    {projectIdx:7,title:'Geotechnical Survey — DeLand',type:'Engineering',status:'Ready to Start',priority:'Medium',description:'Commission geotech survey for DeLand GST foundation design.',assignee:'James Wright',approver:null,requiresApproval:false,approvalStatus:null,dueDate:'2026-05-15'},
    {projectIdx:8,title:'FPL Interconnection Application — Palm Coast',type:'Interconnection',status:'Draft',priority:'High',description:'Prepare FPL interconnection application package for Palm Coast.',assignee:'Morgan Brawner',approver:null,requiresApproval:false,approvalStatus:null,dueDate:'2026-06-01'},
    {projectIdx:10,title:'FPL Interconnection Application — Daytona Beach',type:'Interconnection',status:'Draft',priority:'High',description:'Prepare FPL interconnection application for Daytona Beach campus.',assignee:'Morgan Brawner',approver:null,requiresApproval:false,approvalStatus:null,dueDate:'2026-06-01'},
    {projectIdx:12,title:'Roof Condition Assessment — Fish Memorial',type:'Engineering',status:'In Progress',priority:'Medium',description:'Conduct roof condition and structural assessment for Fish Memorial.',assignee:'James Wright',approver:null,requiresApproval:false,approvalStatus:null,dueDate:'2026-04-20'},
    {projectIdx:19,title:'Lease Agreement — Consolidated Services Center',type:'Legal',status:'In Progress',priority:'Medium',description:'Finalize rooftop lease agreement for Consolidated Services Center.',assignee:'Sarah Chen',approver:'Morgan Brawner',requiresApproval:true,approvalStatus:'Pending',dueDate:'2026-04-30'},
    {projectIdx:15,title:'Prepare TR01-GLR Investor Package',type:'Financial',status:'In Progress',priority:'High',description:'Compile investor-ready package for TR01-GLR tranche.',assignee:'Morgan Brawner',approver:null,requiresApproval:false,approvalStatus:null,dueDate:'2026-04-30'},
    {projectIdx:1,title:'Coordinate AH Facilities Access — All FL Sites',type:'Administrative',status:'In Progress',priority:'Medium',description:'Work with AdventHealth facilities management to coordinate site access.',assignee:'Sarah Chen',approver:null,requiresApproval:false,approvalStatus:null,dueDate:'2026-05-01'},
    {projectIdx:3,title:'Insurance Certificate — All Projects',type:'Administrative',status:'Pending Info',priority:'Low',description:'Obtain updated certificate of insurance from carrier.',assignee:'Sarah Chen',approver:null,requiresApproval:false,approvalStatus:null,dueDate:'2026-05-15'},
    {projectIdx:16,title:'Equipment Procurement RFP — Modules & Inverters',type:'Operations',status:'Under Review',priority:'High',description:'Issue and evaluate RFP responses for PV modules and inverters.',assignee:'James Wright',approver:'Morgan Brawner',requiresApproval:true,approvalStatus:'Pending',dueDate:'2026-04-20'},
  ]

  for (const t of taskData) {
    const projNum = taskProjectNumbers[t.projectIdx]
    const projectId = projNum ? projectIdMap[projNum] : null
    const { error } = await supabase.from('tasks').insert({
      project_id: projectId,
      title: t.title,
      type: t.type,
      status: t.status,
      priority: t.priority,
      description: t.description,
      assignee_id: t.assignee ? taskAssignees[t.assignee] : null,
      approver_id: t.approver ? taskAssignees[t.approver] : null,
      requires_approval: t.requiresApproval,
      approval_status: t.approvalStatus,
      due_date: t.dueDate,
    })
    if (error) console.error(`Task error (${t.title}):`, error.message)
  }
  console.log('Tasks seeded')

  console.log('Seed complete!')
}

seed().catch(console.error)
