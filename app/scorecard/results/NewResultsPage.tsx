import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { getDoc, doc } from 'firebase/firestore';
import { Loader } from '@/components/learning-hub/loader';
import Image from 'next/image';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';

// Import mock data for development
import { mockLeaderReport, mockEnablerReport, mockDabblerReport, getMockReportByTier } from '@/lib/mockData';

// Development flag - set to true to use mock data instead of Firestore
// Set this to false before deploying to production
const USE_MOCK_DATA = false;
// You can specify which mock report to use during development
const MOCK_TIER_FOR_DEV = "leader"; // "leader", "enabler", or "dabbler"

// Import all section components
import { 
  DetailedAnalysisSection 
} from '@/components/scorecard/sections/SectionComponents';

// Import enhanced section components
import KeyFindingsSection from '@/components/scorecard/sections/KeyFindingsSection';
import { StrategicActionPlanSection } from '@/components/scorecard/sections/StrategicActionPlanSection';
import { BenchmarksSection } from '@/components/scorecard/sections/BenchmarksSection';
import { QAndASection } from '@/components/scorecard/sections/QAndASection';
import { LearningPathSection } from '@/components/scorecard/sections/LearningPathSection';

// Client color palette
const colors = {
  brightGreen: '#20E28F',
  darkTeal: '#103138',
  white: '#FFFFFF',
  lightMint: '#F3FDF5',
  orange: '#FE7F01',
  yellow: '#FEC401',
  lightBlue: '#01CEFE',
  cream1: '#FFF9F2',
  cream2: '#FFFCF2',
  lightBlueShade: '#F5FDFF'
};

export default function NewResultsPage() {
  // State variables
  const [activeTab, setActiveTab] = useState('Overall Tier');
  const [reportMarkdown, setReportMarkdown] = useState<string | null>(null);
  const [questionAnswerHistory, setQuestionAnswerHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userTier, setUserTier] = useState<string | null>(null);
  const [animating, setAnimating] = useState(false);
  const [strengths, setStrengths] = useState<string[]>([]);
  const [weaknesses, setWeaknesses] = useState<string[]>([]);
  const [actionItems, setActionItems] = useState<string[]>([]);
  const [isSharing, setIsSharing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
  // Refs for scroll animations
  const contentRef = useRef<HTMLDivElement>(null);

  // Important: Make this safe for SSG by checking if window is defined
  const searchParams = useSearchParams();
  
  // Data fetching - Protect for SSG environment
  useEffect(() => {
    async function fetchReportData() {
      try {
        setIsLoading(true);
        setError(null);
        
        // Get reportId from URL or storage
        let reportId: string | null = null;

        if (searchParams) {
          reportId = searchParams.get('reportId');
          console.log("RESULTS PAGE: Got reportId from URL params:", reportId);
        }
        
        if (!reportId && typeof window !== 'undefined') {
          reportId = sessionStorage.getItem('currentReportID') || sessionStorage.getItem('reportId');
          if (!reportId) {
            reportId = localStorage.getItem('currentReportID') || localStorage.getItem('reportId');
          }
        }
        
        if (!reportId) {
          throw new Error("No reportId found in URL or storage");
        }
        
            console.log("RESULTS PAGE: Attempting to fetch report from Firestore with ID:", reportId);
            
            // Fetch report data from Firestore
            const reportRef = doc(db, 'scorecardReports', reportId);
            const reportSnapshot = await getDoc(reportRef);
            
        if (!reportSnapshot.exists()) {
          throw new Error(`No report found in Firestore with ID: ${reportId}`);
        }
        
        const reportData = reportSnapshot.data();
        console.log("RESULTS PAGE: Full Firestore report data:", {
          id: reportSnapshot.id,
          reportMarkdownPreview: reportData.reportMarkdown?.substring(0, 100) + '...',
          tier: reportData.tier || reportData.userAITier || reportData.aiTier,
          answersCount: reportData.questionAnswerHistory?.length || 0,
          timestamp: reportData.timestamp?.toDate?.() || reportData.timestamp,
        });
        
        // Extract all necessary data with fallbacks
        const reportMarkdownValue = reportData.reportMarkdown || reportData.markdown;
          if (!reportMarkdownValue) {
          throw new Error("Report markdown is missing from Firestore document");
        }
        
        const questionAnswerHistoryValue = reportData.questionAnswerHistory || reportData.answers || [];
        const userNameValue = reportData.userName || reportData.leadName || 'User';
        
        // Extract tier with multiple fallbacks
        let userTierValue = reportData.tier || reportData.userAITier || reportData.aiTier;
        
        // If tier is missing/unknown, try to extract from markdown
        if (!userTierValue || userTierValue === 'Unknown') {
            userTierValue = extractTierFromMarkdown(reportMarkdownValue);
          console.log("RESULTS PAGE: Extracted tier from markdown:", userTierValue);
        }
        
        // Validate tier
        if (!userTierValue || !['Dabbler', 'Enabler', 'Leader'].includes(userTierValue)) {
          console.error("RESULTS PAGE: Invalid tier value:", userTierValue);
          userTierValue = extractTierFromMarkdown(reportMarkdownValue) || 'Unknown';
        }
        
        // Extract sections
        const extractedStrengths = extractStrengthsFromMarkdown(reportMarkdownValue);
        const extractedWeaknesses = extractWeaknessesFromMarkdown(reportMarkdownValue);
        const extractedActions = extractActionsFromMarkdown(reportMarkdownValue);
        
        // Update all state at once to minimize re-renders
        setReportMarkdown(reportMarkdownValue);
        setQuestionAnswerHistory(questionAnswerHistoryValue);
        setUserName(userNameValue);
        setUserTier(userTierValue);
          setStrengths(extractedStrengths);
          setWeaknesses(extractedWeaknesses);
          setActionItems(extractedActions);
          
        // Backup to storage
        if (typeof window !== 'undefined') {
          try {
            // Session storage
            sessionStorage.setItem('reportMarkdown', reportMarkdownValue);
            sessionStorage.setItem('questionAnswerHistory', JSON.stringify(questionAnswerHistoryValue));
            sessionStorage.setItem('userAITier', userTierValue);
            sessionStorage.setItem('reportId', reportId);
            
            // Local storage backup
            localStorage.setItem('reportMarkdown', reportMarkdownValue);
            localStorage.setItem('questionAnswerHistory', JSON.stringify(questionAnswerHistoryValue));
            localStorage.setItem('userAITier', userTierValue);
            localStorage.setItem('reportId', reportId);
          } catch (storageError) {
            console.error("Failed to backup to storage:", storageError);
            // Non-critical error, don't throw
          }
        }
      } catch (error) {
        console.error("RESULTS PAGE ERROR:", error);
        setError(error instanceof Error ? error.message : 'Failed to load report');
      } finally {
        setIsLoading(false);
      }
    }
    
      fetchReportData();
  }, [searchParams]); // Only re-run if searchParams changes

  // Helper functions to extract data from markdown
  const extractTierFromMarkdown = (markdown: string | null): string | null => {
    if (!markdown) return null;
    
    console.log('EXTRACT TIER: Extracting tier from markdown');
    
    // First try to find the specific "Overall Tier" heading
    const tierMatch = markdown.match(/## Overall Tier:?\s*(.+?)($|\n)/i);
    if (tierMatch && tierMatch[1]) {
      const extracted = tierMatch[1].trim();
      console.log('EXTRACT TIER: Found tier via "Overall Tier" heading:', extracted);
      return extracted;
    }
    
    // Next, try to find tier mentioned after "Overall" heading
    const overallMatch = markdown.match(/## Overall:?\s*(.+?)($|\n)/i);
    if (overallMatch && overallMatch[1]) {
      const line = overallMatch[1].trim();
      // Look for Leader, Enabler, or Dabbler in this line
      if (line.includes('Leader') || line.includes('leader')) return 'Leader';
      if (line.includes('Enabler') || line.includes('enabler')) return 'Enabler';
      if (line.includes('Dabbler') || line.includes('dabbler')) return 'Dabbler';
    }
    
    // If not found yet, try looking for the terms with specific formatting
    const leaderBoldMatch = markdown.match(/\*\*Leader\*\*/i) || markdown.match(/__Leader__/i);
    if (leaderBoldMatch) {
      console.log('EXTRACT TIER: Found tier via bold "Leader" format');
      return 'Leader';
    }
    
    const enablerBoldMatch = markdown.match(/\*\*Enabler\*\*/i) || markdown.match(/__Enabler__/i);
    if (enablerBoldMatch) {
      console.log('EXTRACT TIER: Found tier via bold "Enabler" format');
      return 'Enabler';
    }
    
    const dabblerBoldMatch = markdown.match(/\*\*Dabbler\*\*/i) || markdown.match(/__Dabbler__/i);
    if (dabblerBoldMatch) {
      console.log('EXTRACT TIER: Found tier via bold "Dabbler" format');
      return 'Dabbler';
    }
    
    // Fallback to searching for Leader, Enabler, or Dabbler anywhere in the markdown
    // Looking for most frequent tier mentioned
    const leaderCount = (markdown.match(/Leader/gi) || []).length;
    const enablerCount = (markdown.match(/Enabler/gi) || []).length;
    const dabblerCount = (markdown.match(/Dabbler/gi) || []).length;
    
    console.log('EXTRACT TIER: Term frequency -', { leaderCount, enablerCount, dabblerCount });
    
    if (leaderCount > enablerCount && leaderCount > dabblerCount && leaderCount > 0) {
      console.log('EXTRACT TIER: Found tier via frequency of "Leader"');
      return 'Leader';
    } else if (enablerCount > leaderCount && enablerCount > dabblerCount && enablerCount > 0) {
      console.log('EXTRACT TIER: Found tier via frequency of "Enabler"');
      return 'Enabler';
    } else if (dabblerCount > 0) {
      console.log('EXTRACT TIER: Found tier via frequency of "Dabbler"');
      return 'Dabbler';
    }
    
    // If we still can't determine, return "Enabler" as a default
    console.log('EXTRACT TIER: Could not determine tier from markdown content, using default "Enabler"');
    return 'Enabler';
  };
  
  const extractStrengthsFromMarkdown = (markdown: string): string[] => {
    console.log('EXTRACT STRENGTHS: Extracting strengths from markdown');
    
    // Try different patterns to find strengths section
    let strengthsSection = null;
    
    // Pattern 1: Standard "Strengths" heading
    const pattern1 = markdown.match(/## Strengths[:\s]*([\s\S]*?)(?=##|$)/i);
    if (pattern1 && pattern1[1]) {
      strengthsSection = pattern1[1];
      console.log('EXTRACT STRENGTHS: Found strengths via pattern 1 (standard heading)');
    }
    
    // Pattern 2: Inside "Key Findings" section
    if (!strengthsSection) {
      const keyFindingsSection = markdown.match(/## Key Findings[:\s]*([\s\S]*?)(?=##|$)/i);
      if (keyFindingsSection && keyFindingsSection[1]) {
        const strengthsInFindings = keyFindingsSection[1].match(/Strengths[:\s]*([\s\S]*?)(?=Weaknesses|Areas for Improvement|##|$)/i);
        if (strengthsInFindings && strengthsInFindings[1]) {
          strengthsSection = strengthsInFindings[1];
          console.log('EXTRACT STRENGTHS: Found strengths via pattern 2 (inside Key Findings)');
        }
      }
    }
    
    // If we found a strengths section, extract the bullet points
    if (strengthsSection) {
      const strengthsList = strengthsSection.split('\n')
        .filter(line => line.trim().startsWith('- ') || line.trim().startsWith('* ') || line.trim().match(/^\d+\.\s/))
        .map(line => line.trim().replace(/^[*-]\s+/, '').replace(/^\d+\.\s+/, ''))
        .filter(line => line.length > 0);
        
      console.log('EXTRACT STRENGTHS: Found', strengthsList.length, 'strengths');
      
      return strengthsList.slice(0, 5); // Limit to 5 strengths
    }
    
    // If no strengths section found with specific headings, look for bullet points after a "strong" or "strength" keyword
    const strengthKeywordSection = markdown.match(/(strength|strong)[^\n]*\n+((?:[*-]\s+[^\n]+\n*)+)/i);
    if (strengthKeywordSection && strengthKeywordSection[2]) {
      const strengthsList = strengthKeywordSection[2].split('\n')
        .filter(line => line.trim().startsWith('- ') || line.trim().startsWith('* '))
        .map(line => line.trim().replace(/^[*-]\s+/, ''))
        .filter(line => line.length > 0);
        
      console.log('EXTRACT STRENGTHS: Found', strengthsList.length, 'strengths via keyword pattern');
      
      if (strengthsList.length > 0) {
        return strengthsList.slice(0, 5);
      }
    }
    
    // Last resort: Find first set of bullet points in the document
    const firstBulletPoints = markdown.match(/(?:[*-]\s+[^\n]+\n*){2,}/);
    if (firstBulletPoints) {
      const bulletList = firstBulletPoints[0].split('\n')
        .filter(line => line.trim().startsWith('- ') || line.trim().startsWith('* '))
        .map(line => line.trim().replace(/^[*-]\s+/, ''))
        .filter(line => line.length > 0);
        
      console.log('EXTRACT STRENGTHS: Using first bullet points as fallback, found', bulletList.length, 'items');
      
      if (bulletList.length > 0) {
        return bulletList.slice(0, 5);
      }
    }
    
    console.log('EXTRACT STRENGTHS: Could not find any strengths in the markdown');
    return [];
  };
  
  const extractWeaknessesFromMarkdown = (markdown: string): string[] => {
    console.log('EXTRACT WEAKNESSES: Extracting weaknesses from markdown');
    
    // Try different patterns to find weaknesses section
    let weaknessesSection = null;
    
    // Pattern 1: Standard "Weaknesses" or variations heading
    const pattern1 = markdown.match(/## (Weaknesses|Areas for Improvement|Challenges|Opportunities)[:\s]*([\s\S]*?)(?=##|$)/i);
    if (pattern1 && pattern1[2]) {
      weaknessesSection = pattern1[2];
      console.log('EXTRACT WEAKNESSES: Found weaknesses via pattern 1 (standard heading)');
    }
    
    // Pattern 2: Inside "Key Findings" section
    if (!weaknessesSection) {
      const keyFindingsSection = markdown.match(/## Key Findings[:\s]*([\s\S]*?)(?=##|$)/i);
      if (keyFindingsSection && keyFindingsSection[1]) {
        const weaknessesInFindings = keyFindingsSection[1].match(/(Weaknesses|Areas for Improvement|Challenges|Opportunities)[:\s]*([\s\S]*?)(?=##|$)/i);
        if (weaknessesInFindings && weaknessesInFindings[2]) {
          weaknessesSection = weaknessesInFindings[2];
          console.log('EXTRACT WEAKNESSES: Found weaknesses via pattern 2 (inside Key Findings)');
        }
      }
    }
    
    // If we found a weaknesses section, extract the bullet points
    if (weaknessesSection) {
      const weaknessesList = weaknessesSection.split('\n')
        .filter(line => line.trim().startsWith('- ') || line.trim().startsWith('* ') || line.trim().match(/^\d+\.\s/))
        .map(line => line.trim().replace(/^[*-]\s+/, '').replace(/^\d+\.\s+/, ''))
        .filter(line => line.length > 0);
        
      console.log('EXTRACT WEAKNESSES: Found', weaknessesList.length, 'weaknesses');
      
      return weaknessesList.slice(0, 5); // Limit to 5 weaknesses
    }
    
    // If no weaknesses section found with specific headings, look for bullet points after a weakness-related keyword
    const weaknessKeywordSection = markdown.match(/(weakness|improve|challenge|opportunity|gap)[^\n]*\n+((?:[*-]\s+[^\n]+\n*)+)/i);
    if (weaknessKeywordSection && weaknessKeywordSection[2]) {
      const weaknessesList = weaknessKeywordSection[2].split('\n')
        .filter(line => line.trim().startsWith('- ') || line.trim().startsWith('* '))
        .map(line => line.trim().replace(/^[*-]\s+/, ''))
        .filter(line => line.length > 0);
        
      console.log('EXTRACT WEAKNESSES: Found', weaknessesList.length, 'weaknesses via keyword pattern');
      
      if (weaknessesList.length > 0) {
        return weaknessesList.slice(0, 5);
      }
    }
    
    // Last resort: Find second set of bullet points in the document
    const allBulletSections = markdown.match(/(?:[*-]\s+[^\n]+\n*){2,}/g);
    if (allBulletSections && allBulletSections.length > 1) {
      const secondBulletPoints = allBulletSections[1]; // Use the second bullet list
      const bulletList = secondBulletPoints.split('\n')
        .filter(line => line.trim().startsWith('- ') || line.trim().startsWith('* '))
        .map(line => line.trim().replace(/^[*-]\s+/, ''))
        .filter(line => line.length > 0);
        
      console.log('EXTRACT WEAKNESSES: Using second bullet points as fallback, found', bulletList.length, 'items');
      
      if (bulletList.length > 0) {
        return bulletList.slice(0, 5);
      }
    }
    
    console.log('EXTRACT WEAKNESSES: Could not find any weaknesses in the markdown');
    return [];
  };
  
  const extractActionsFromMarkdown = (markdown: string): string[] => {
    console.log('EXTRACT ACTIONS: Extracting action items from markdown');
    
    // Try different patterns to find actions section
    let actionsSection = null;
    
    // Pattern 1: Standard action-related headings
    const pattern1 = markdown.match(/## (Recommendations|Action Plan|Action Items|Next Steps|Strategic Action Plan)[:\s]*([\s\S]*?)(?=##|$)/i);
    if (pattern1 && pattern1[2]) {
      actionsSection = pattern1[2];
      console.log('EXTRACT ACTIONS: Found actions via pattern 1 (standard heading)');
    }
    
    // If we found an actions section, extract the bullet points
    if (actionsSection) {
      const actionsList = actionsSection.split('\n')
        .filter(line => line.trim().startsWith('- ') || line.trim().startsWith('* ') || line.trim().match(/^\d+\.\s/))
        .map(line => line.trim().replace(/^[*-]\s+/, '').replace(/^\d+\.\s+/, ''))
        .filter(line => line.length > 0);
        
      console.log('EXTRACT ACTIONS: Found', actionsList.length, 'actions');
      
      return actionsList.slice(0, 5); // Limit to 5 action items
    }
    
    // If no actions section found with specific headings, look for numbered lists that might indicate actions
    const numberedListSection = markdown.match(/(?:\d+\.\s+[^\n]+\n*){2,}/);
    if (numberedListSection) {
      const numberedList = numberedListSection[0].split('\n')
        .filter(line => line.trim().match(/^\d+\.\s/))
        .map(line => line.trim().replace(/^\d+\.\s+/, ''))
        .filter(line => line.length > 0);
        
      console.log('EXTRACT ACTIONS: Found', numberedList.length, 'actions via numbered list pattern');
      
      if (numberedList.length > 0) {
        return numberedList.slice(0, 5);
      }
    }
    
    // Look for bullet points after action-related keywords
    const actionKeywordSection = markdown.match(/(recommendation|action|next step|implement|strategic)[^\n]*\n+((?:[*-]\s+[^\n]+\n*)+)/i);
    if (actionKeywordSection && actionKeywordSection[2]) {
      const actionsList = actionKeywordSection[2].split('\n')
        .filter(line => line.trim().startsWith('- ') || line.trim().startsWith('* '))
        .map(line => line.trim().replace(/^[*-]\s+/, ''))
        .filter(line => line.length > 0);
        
      console.log('EXTRACT ACTIONS: Found', actionsList.length, 'actions via keyword pattern');
      
      if (actionsList.length > 0) {
        return actionsList.slice(0, 5);
      }
    }
    
    // Last resort: Find the third or last set of bullet points in the document
    const allBulletSections = markdown.match(/(?:[*-]\s+[^\n]+\n*){2,}/g);
    if (allBulletSections && allBulletSections.length > 0) {
      // Use the third bullet list if available, otherwise use the last one
      const bulletPointsSection = allBulletSections.length > 2 ? allBulletSections[2] : allBulletSections[allBulletSections.length - 1];
      const bulletList = bulletPointsSection.split('\n')
        .filter(line => line.trim().startsWith('- ') || line.trim().startsWith('* '))
        .map(line => line.trim().replace(/^[*-]\s+/, ''))
        .filter(line => line.length > 0);
        
      console.log('EXTRACT ACTIONS: Using bullet points as fallback, found', bulletList.length, 'items');
      
      if (bulletList.length > 0) {
        return bulletList.slice(0, 5);
      }
    }
    
    console.log('EXTRACT ACTIONS: Could not find any action items in the markdown');
    return [];
  };

  // Handle tab changes
  const handleTabChange = (tabName: string) => {
    setAnimating(true);
    setTimeout(() => {
      setActiveTab(tabName);
      setAnimating(false);
      // Scroll to top when changing tabs
      contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, 200);
  };

  // Handle report sharing
  const handleShareReport = () => {
    try {
      setIsSharing(true);
      
      // Create shareable URL with reportId
      const reportId = searchParams?.get('reportId') || 
        (typeof window !== 'undefined' ? 
          sessionStorage.getItem('currentReportID') || 
          sessionStorage.getItem('reportId') || 
          localStorage.getItem('currentReportID') || 
          localStorage.getItem('reportId') : null);
      
      if (!reportId) {
        throw new Error('No report ID found to share');
      }
      
      // Create the URL to share
      const shareUrl = `${window.location.origin}/scorecard/results?reportId=${reportId}`;
      
      // Try to use the Web Share API if available
      if (navigator.share) {
        navigator.share({
          title: `AI Efficiency Scorecard for ${userName || 'your organization'}`,
          text: `Check out this AI Efficiency Scorecard (Tier: ${userTier || 'Evaluation'})`,
          url: shareUrl
        }).catch(err => {
          console.error('Share failed:', err);
          // Fallback to clipboard if share fails
          navigator.clipboard.writeText(shareUrl);
          alert('Link copied to clipboard!');
        });
      } else {
        // Fallback for browsers without Web Share API
        navigator.clipboard.writeText(shareUrl);
        alert('Link copied to clipboard!');
      }
    } catch (error) {
      console.error('Failed to share report:', error);
      alert('Unable to share. Please try copying the URL manually.');
    } finally {
      setIsSharing(false);
    }
  };

  // Handle PDF download
  const handleDownloadPDF = async () => {
    try {
      setIsDownloading(true);
      
      // Get report ID from URL or storage
      const reportId = searchParams?.get('reportId') || 
        (typeof window !== 'undefined' ? 
          sessionStorage.getItem('currentReportID') || 
          sessionStorage.getItem('reportId') || 
          localStorage.getItem('currentReportID') || 
          localStorage.getItem('reportId') : null);
      
      if (!reportId) {
        throw new Error('No report ID found to download');
      }
      
      // Instead of downloading a PDF, we'll open the HTML report in a new tab
      window.open(`/api/generate-pdf?reportId=${reportId}`, '_blank');
      
      // Set a brief timeout before resetting the loading state
      // This gives visual feedback that something happened
      setTimeout(() => {
        setIsDownloading(false);
      }, 500);
      
    } catch (error) {
      console.error('Failed to open report:', error);
      
      let errorMessage = 'Unable to open report. Please try again later.';
      
      // Provide more specific error messages for common issues
      if (error instanceof Error) {
        if (error.message.includes('report ID')) {
          errorMessage = 'Unable to open report: Your report ID is missing or invalid.';
        } else if (error.message.includes('Network') || error.message.includes('Failed to fetch')) {
          errorMessage = 'Unable to open report: Network connection issue. Please check your internet connection.';
        } else if (error.message.includes('Server error') || error.message.includes('Status: 5')) {
          errorMessage = 'Unable to open report: Server error. Our team has been notified and is working on a fix.';
        }
      }
      
      alert(errorMessage);
      setIsDownloading(false);
    }
  };

  // Helper function to generate recommendation descriptions
  const getRecommendationDescription = (index: number, action: string): string => {
    // Generate contextual descriptions based on keywords in the action item
    const actionLower = action.toLowerCase();
    
    if (actionLower.includes('strategy') || actionLower.includes('roadmap') || actionLower.includes('vision')) {
      return "Develop a clear strategic direction to align AI initiatives with business objectives and maximize ROI.";
    }
    
    if (actionLower.includes('team') || actionLower.includes('talent') || actionLower.includes('skill') || actionLower.includes('training')) {
      return "Build the necessary skills and expertise to successfully implement and manage AI solutions across your organization.";
    }
    
    if (actionLower.includes('data') || actionLower.includes('infrastructure') || actionLower.includes('platform')) {
      return "Establish the foundation for successful AI implementation with robust data management and technical infrastructure.";
    }
    
    if (actionLower.includes('governance') || actionLower.includes('ethic') || actionLower.includes('policy') || actionLower.includes('standard')) {
      return "Implement frameworks to ensure responsible, compliant, and ethical AI use aligned with your organization's values.";
    }
    
    if (actionLower.includes('pilot') || actionLower.includes('experiment') || actionLower.includes('test')) {
      return "Start with targeted pilot projects to demonstrate value, build momentum, and learn from practical implementation.";
    }
    
    // Generic descriptions if no specific keywords match
    const genericDescriptions = [
      "Implement this recommendation to advance your organization's AI maturity and drive business value.",
      "This strategic action will help build foundational capabilities necessary for AI success.",
      "Focus on this area to address key gaps identified in your AI maturity assessment.",
      "Prioritize this recommendation to gain competitive advantage through enhanced AI capabilities.",
      "This action represents a critical step toward more advanced AI implementation and value creation."
    ];
    
    return genericDescriptions[index % genericDescriptions.length];
  };
  
  // Helper function to get tier description
  const getTierDescription = (tier: string | null): string => {
    if (!tier) return "";
    
    switch(tier.toLowerCase()) {
      case 'leader':
        return " This means your organization has developed mature AI capabilities, with well-established processes for developing, deploying, and managing AI solutions. You have a strong foundation of data infrastructure, AI talent, governance frameworks, and strategic alignment.";
      case 'enabler':
        return " This means your organization has begun to develop significant AI capabilities with some successful implementations. You have established basic data infrastructure and are working toward more systematized approaches to AI development and deployment.";
      case 'dabbler':
        return " This means your organization is in the early stages of AI adoption, with limited formal processes and capabilities. You may have experimented with some AI applications but lack a comprehensive strategy and infrastructure for AI implementation.";
      default:
        return " Your assessment results indicate you're at an early stage of AI adoption. The recommendations in this report will help you establish a solid foundation for AI implementation.";
    }
  };
  
  // Helper function to get tier strengths
  const getTierStrengths = (tier: string | null): string[] => {
    if (!tier) return [];
    
    switch(tier.toLowerCase()) {
      case 'leader':
        return [
          "Strong alignment between AI initiatives and business strategy",
          "Established data infrastructure and governance",
          "Effective AI talent acquisition and development",
          "Mature processes for AI development and deployment",
          "Clear frameworks for responsible AI use"
        ];
      case 'enabler':
        return [
          "Growing alignment of AI initiatives with business goals",
          "Developing data infrastructure and practices",
          "Building internal AI capabilities and expertise",
          "Successful implementation of selected AI use cases",
          "Emerging governance frameworks"
        ];
      case 'dabbler':
        return [
          "Initial experimentation with AI technologies",
          "Recognition of AI's potential value",
          "Willingness to explore and learn about AI applications",
          "Some pockets of data collection and management",
          "Early-stage awareness of AI governance needs"
        ];
      default:
        return [
          "Interest in exploring AI potential",
          "Recognition of the need for digital transformation",
          "Openness to innovation and new technologies",
          "Ability to start with a clean slate in AI implementation"
        ];
    }
  };
  
  // Helper function to get tier focus areas
  const getTierFocusAreas = (tier: string | null): string[] => {
    if (!tier) return [];
    
    switch(tier.toLowerCase()) {
      case 'leader':
        return [
          "Scaling AI initiatives across the organization",
          "Optimizing AI operations and processes",
          "Developing cutting-edge AI capabilities",
          "Expanding responsible AI frameworks",
          "Leveraging AI for competitive advantage"
        ];
      case 'enabler':
        return [
          "Formalizing AI strategy and governance",
          "Expanding data infrastructure and capabilities",
          "Systematizing AI development processes",
          "Building broader AI talent and skills",
          "Integrating AI more deeply with business processes"
        ];
      case 'dabbler':
        return [
          "Developing an AI strategy and roadmap",
          "Building foundational data infrastructure",
          "Identifying high-value AI use cases",
          "Acquiring essential AI skills and expertise",
          "Establishing basic AI governance frameworks"
        ];
      default:
        return [
          "Understanding AI fundamentals and potential",
          "Assessing current data capabilities",
          "Identifying initial AI use cases",
          "Building awareness of AI best practices"
        ];
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-white">
        <div className="w-24 h-24 mb-8 border-4 border-sg-bright-green/30 border-t-sg-bright-green rounded-full animate-spin"></div>
        <h2 className="text-2xl font-bold mb-3 text-sg-dark-teal">Loading Your AI Scorecard</h2>
        <p className="text-sg-dark-teal/70 text-center max-w-md">
          Please wait while we prepare your results. This may take a few moments...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-white p-6">
        <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-lg max-w-lg w-full mb-6">
          <h2 className="text-2xl font-bold mb-3 text-red-700">Unable to Load Results</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <p className="text-sg-dark-teal/70 mb-6">
            We're having trouble loading your report. This could be due to:
            <ul className="list-disc pl-6 mt-2">
              <li>Your session has expired</li>
              <li>The report ID was incorrect or missing</li>
              <li>A temporary network issue</li>
            </ul>
          </p>
          <div className="flex space-x-4">
            <button 
              onClick={() => window.location.reload()} 
              className="px-6 py-3 bg-sg-bright-green text-white font-semibold rounded-lg shadow-sm hover:brightness-105 transition-all"
            >
              Retry Loading
            </button>
            <button 
              onClick={() => window.location.href = '/'}  
              className="px-6 py-3 bg-sg-dark-teal text-white font-semibold rounded-lg shadow-sm hover:brightness-105 transition-all"
            >
              Return to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      {reportMarkdown ? (
        <>
          {/* Header */}
          <header className="header">
            <div className="header-content">
              <div className="flex items-center gap-3">
                <div className="logo-container">
                  <div className="logo-inner">AI</div>
                </div>
                <h1>AI Efficiency Scorecard</h1>
              </div>
              <div className="header-actions">
                <button 
                  className="btn-primary flex items-center gap-2"
                  onClick={handleShareReport}
                  disabled={isSharing}
                >
                  {isSharing ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></div>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M13.5 3H12H8C6.34315 3 5 4.34315 5 6V18C5 19.6569 6.34315 21 8 21H16C17.6569 21 19 19.6569 19 18V10.5V8.37868M13.5 3L19 8.37868M13.5 3V7.5C13.5 8.5 13.9477 8.5 14.5 8.5H19M19 8.37868V8.5M14 11.5H10M14 15.5H10M8 7.5H10" 
                        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                  {isSharing ? 'Sharing...' : 'Share Report'}
                </button>
                <button 
                  className="btn-secondary flex items-center gap-2"
                  onClick={handleDownloadPDF}
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin mr-1"></div>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M8 7H16M8 12H16M8 17H12M4 4.5V19.5C4 19.9644 4 20.1966 4.02567 20.391C4.2029 21.8381 5.16192 22.7971 6.60896 22.9743C6.80336 23 7.03558 23 7.5 23H16.5C16.9644 23 17.1966 23 17.391 22.9743C18.8381 22.7971 19.7971 21.8381 19.9743 20.391C20 20.1966 20 19.9644 20 19.5V4.5C20 4.03558 20 3.80336 19.9743 3.60896C19.7971 2.16192 18.8381 1.2029 17.391 1.02567C17.1966 1 16.9644 1 16.5 1H7.5C7.03558 1 6.80336 1 6.60896 1.02567C5.16192 1.2029 4.2029 2.16192 4.02567 3.60896C4 3.80336 4 4.03558 4 4.5Z" 
                        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                  {isDownloading ? 'Opening Report...' : 'View Report'}
                </button>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <div className="main-content">
            {/* Sidebar / Navigation */}
            <div className="sidebar">
              <div className="tier-indicator">
                <div className="tier-circle">
                  <span className="tier-text">{userTier || 'N/A'}</span>
                  <span className="tier-label">AI Maturity</span>
                </div>
              </div>
              
              <div className="tier-progress">
                <div className="tier-progress-label">Your Progress</div>
                <div className="tier-progress-bar">
                  <div 
                    className="tier-progress-fill" 
                    style={{ 
                      width: userTier === 'Leader' ? '100%' : 
                             userTier === 'Enabler' ? '66%' : 
                             userTier === 'Dabbler' ? '33%' : '0%' 
                    }}
                  ></div>
                </div>
                <div className="tier-progress-labels">
                  <span>Dabbler</span>
                  <span>Enabler</span>
                  <span>Leader</span>
                </div>
              </div>
              
              <nav className="nav-menu">
                <div className="nav-section-title">Navigate Report</div>
                <ul>
                  <li 
                    className={`nav-item ${activeTab === 'Overall Tier' ? 'active' : ''}`}
                    onClick={() => handleTabChange('Overall Tier')}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2L20 7V17L12 22L4 17V7L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12 22V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M20 7L12 12L4 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Overall Tier
                  </li>
                  <li 
                    className={`nav-item ${activeTab === 'Key Findings' ? 'active' : ''}`}
                    onClick={() => handleTabChange('Key Findings')}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9 10.5L11 12.5L15.5 8M7 18V20.3355C7 20.8684 7 21.1348 7.10923 21.2716C7.20422 21.3906 7.34827 21.4599 7.50054 21.4597C7.67563 21.4595 7.88367 21.2931 8.29976 20.9602L10.6852 19.0518C11.1725 18.662 11.4162 18.4671 11.6875 18.3285C11.9282 18.2055 12.1844 18.1156 12.4492 18.0613C12.7477 18 13.0597 18 13.6837 18H16.2C17.8802 18 18.7202 18 19.362 17.673C19.9265 17.3854 20.3854 16.9265 20.673 16.362C21 15.7202 21 14.8802 21 13.2V7.8C21 6.11984 21 5.27976 20.673 4.63803C20.3854 4.07354 19.9265 3.6146 19.362 3.32698C18.7202 3 17.8802 3 16.2 3H7.8C6.11984 3 5.27976 3 4.63803 3.32698C4.07354 3.6146 3.6146 4.07354 3.32698 4.63803C3 5.27976 3 6.11984 3 7.8V14C3 14.93 3 15.395 3.10222 15.7765C3.37962 16.8117 4.18827 17.6204 5.22354 17.8978C5.60504 18 6.07003 18 7 18Z" 
                        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Key Findings
                  </li>
                  <li 
                    className={`nav-item ${activeTab === 'Recommendations' ? 'active' : ''}`}
                    onClick={() => handleTabChange('Recommendations')}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9 6H20M9 12H20M9 18H20M5 6V6.01M5 12V12.01M5 18V18.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Recommendations
                  </li>
                  <li 
                    className={`nav-item ${activeTab === 'Strategic Action Plan' ? 'active' : ''}`}
                    onClick={() => handleTabChange('Strategic Action Plan')}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2 9H16M12 13H16M12 17H16M6 13V21M2 5H22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Strategic Action Plan
                  </li>
                  <li 
                    className={`nav-item ${activeTab === 'Detailed Analysis' ? 'active' : ''}`}
                    onClick={() => handleTabChange('Detailed Analysis')}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M10 9H6M15.5 11C13.567 11 12 9.433 12 7.5C12 5.567 13.567 4 15.5 4C17.433 4 19 5.567 19 7.5C19 9.433 17.433 11 15.5 11ZM6.5 21C4.567 21 3 19.433 3 17.5C3 15.567 4.567 14 6.5 14C8.433 14 10 15.567 10 17.5C10 19.433 8.433 21 6.5 21ZM18 16.5H14M18 19.5H14M6 6L10 6" 
                        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    Detailed Analysis
                  </li>
                  <li 
                    className={`nav-item ${activeTab === 'Benchmarks' ? 'active' : ''}`}
                    onClick={() => handleTabChange('Benchmarks')}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M21 21H6.2C5.07989 21 4.51984 21 4.09202 20.782C3.71569 20.5903 3.40973 20.2843 3.21799 19.908C3 19.4802 3 18.9201 3 17.8V3M7 16V14M11.5 16V12M16 16V10M14 21V7L18 3H21V21H14Z" 
                        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Illustrative Benchmarks
                  </li>
                  <li 
                    className={`nav-item ${activeTab === 'Assessment Q&A' ? 'active' : ''}`}
                    onClick={() => handleTabChange('Assessment Q&A')}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M7.9 8.08 C 8.2 8.08 8.44 8.32 8.44 8.62 8.44 8.92 8.2 9.16 7.9 9.16 7.6 9.16 7.36 8.92 7.36 8.62 7.36 8.32 7.6 8.08 7.9 8.08 Z" 
                        fill="currentColor"/>
                      <path d="M12.1 8.08 C 12.4 8.08 12.64 8.32 12.64 8.62 12.64 8.92 12.4 9.16 12.1 9.16 11.8 9.16 11.56 8.92 11.56 8.62 11.56 8.32 11.8 8.08 12.1 8.08 Z" 
                        fill="currentColor"/>
                      <path d="M16.3 8.08 C 16.6 8.08 16.84 8.32 16.84 8.62 16.84 8.92 16.6 9.16 16.3 9.16 16 9.16 15.76 8.92 15.76 8.62 15.76 8.32 16 8.08 16.3 8.08 Z" 
                        fill="currentColor"/>
                      <path d="M20 6.77V15.5C20 16.6 19.1 17.5 18 17.5H13.44L9.31 19.7C9.13 19.8 8.92 19.84 8.73 19.82C8.36 19.79 8.09 19.5 8.09 19.14V17.5H6C4.9 17.5 4 16.6 4 15.5V6.77C4 5.67 4.9 4.77 6 4.77H18C19.1 4.77 20 5.67 20 6.77Z" 
                        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Assessment Q&A
                  </li>
                  <li 
                    className={`nav-item ${activeTab === 'Learning Path' ? 'active' : ''}`}
                    onClick={() => handleTabChange('Learning Path')}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 9V4M12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15M12 9C13.6569 9 15 10.3431 15 12C15 13.6569 13.6569 15 12 15M12 15V20M9 4H4V9M9 20H4V15M20 4H15V9M20 15H15V20" 
                        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Your Learning Path & Resources
                  </li>
                </ul>
              </nav>
              
              {userName && (
                <div className="user-info">
                  <div className="user-info-label">Report for</div>
                  <div className="user-info-name">{userName}</div>
                </div>
              )}
            </div>

            {/* Content Panel */}
            <div className={`content-panel ${animating ? 'fade-out' : 'fade-in'}`} ref={contentRef}>
              {activeTab === 'Overall Tier' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-bold text-[#103138] mb-4 flex items-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-3 text-[#20E28F]">
                      <path d="M12 2L20 7V17L12 22L4 17V7L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12 22V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M20 7L12 12L4 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Overall AI Maturity Assessment
                  </h2>
                  
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 pt-6">
                      <div className="flex flex-col md:flex-row md:items-center mb-5">
                        <div className="flex items-center mb-4 md:mb-0 md:mr-8">
                          <div 
                            className={`w-14 h-14 rounded-full border-4 flex items-center justify-center mr-4 ${
                              userTier === 'Leader' ? 'border-[#20E28F] bg-[#F3FDF5]' : 
                              userTier === 'Enabler' ? 'border-orange-500 bg-orange-50' : 
                              'border-blue-400 bg-blue-50'
                            }`}
                          >
                            <span 
                              className={`text-lg font-bold ${
                                userTier === 'Leader' ? 'text-[#20E28F]' : 
                                userTier === 'Enabler' ? 'text-orange-500' : 
                                'text-blue-400'
                              }`}
                            >
                              {userTier?.[0] || '?'}
                            </span>
                          </div>
                          <div>
                            <h3 className="text-2xl font-bold text-[#103138]">{userTier || 'Unknown'}</h3>
                            <p className="text-[#103138]/70 text-sm">AI Maturity Tier</p>
                          </div>
                        </div>
                        
                        <div className="w-full md:w-3/5">
                          <div className="relative h-8 bg-gray-100 rounded-full overflow-hidden">
                            <div className="absolute h-full flex items-center pl-2 text-xs text-white font-semibold w-full">
                              <span className="relative z-10">Dabbler</span>
                              <span className="relative z-10 ml-auto mr-24">Enabler</span>
                              <span className="relative z-10 ml-auto mr-6">Leader</span>
                            </div>
                            <div 
                              className={`absolute h-full transition-all duration-1000 ${
                                userTier === 'Leader' ? 'bg-gradient-to-r from-[#20E28F] to-[#20E28F]/80 w-full' : 
                                userTier === 'Enabler' ? 'bg-gradient-to-r from-[#FE7F01] to-[#FEC401] w-2/3' : 
                                'bg-gradient-to-r from-[#01CEFE] to-[#01CEFE]/80 w-1/3'
                              }`}
                            ></div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-6 bg-[#F3FDF5]/40 rounded-lg border border-[#20E28F]/10 mb-6">
                        <h4 className="font-semibold text-lg text-[#103138] mb-3 flex items-center">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2 text-[#20E28F]">
                            <path d="M9 10.5L11 12.5L15.5 8M7 18V20.3355C7 20.8684 7 21.1348 7.10923 21.2716C7.20422 21.3906 7.34827 21.4599 7.50054 21.4597C7.67563 21.4595 7.88367 21.2931 8.29976 20.9602L10.6852 19.0518C11.1725 18.662 11.4162 18.4671 11.6875 18.3285C11.9282 18.2055 12.1844 18.1156 12.4492 18.0613C12.7477 18 13.0597 18 13.6837 18H16.2C17.8802 18 18.7202 18 19.362 17.673C19.9265 17.3854 20.3854 16.9265 20.673 16.362C21 15.7202 21 14.8802 21 13.2V7.8C21 6.11984 21 5.27976 20.673 4.63803C20.3854 4.07354 19.9265 3.6146 19.362 3.32698C18.7202 3 17.8802 3 16.2 3H7.8C6.11984 3 5.27976 3 4.63803 3.32698C4.07354 3.6146 3.6146 4.07354 3.32698 4.63803C3 5.27976 3 6.11984 3 7.8V14C3 14.93 3 15.395 3.10222 15.7765C3.37962 16.8117 4.18827 17.6204 5.22354 17.8978C5.60504 18 6.07003 18 7 18Z" 
                              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Your Assessment Results
                        </h4>
                        <p className="text-[#103138]/80 leading-relaxed">
                          {userName ? `${userName}, your` : 'Your'} organization is at the <strong className="text-[#103138]">{userTier}</strong> tier of AI maturity.
                          {getTierDescription(userTier)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="p-6 border-t border-gray-100">
                      <h4 className="font-semibold text-[#103138] mb-4">What This Means for Your Organization</h4>
                      
                      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                        <div className="bg-[#F3FDF5]/30 p-4 rounded-lg border border-[#20E28F]/10">
                          <h5 className="font-medium text-[#103138] mb-2 flex items-center">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2 text-[#20E28F]">
                              <path d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" 
                                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            Your Strengths
                          </h5>
                          <ul className="space-y-2">
                            {getTierStrengths(userTier).map((strength, index) => (
                              <li key={index} className="flex items-start gap-2 text-sm">
                                <span className="text-[#20E28F] mt-1">•</span>
                                <span className="text-[#103138]/80">{strength}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                          <h5 className="font-medium text-[#103138] mb-2 flex items-center">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2 text-[#103138]">
                              <path d="M19.5 12c0-1.2-3.8-7.5-7.5-7.5S4.5 10.8 4.5 12c0 3.2 3.4 7.5 7.5 7.5s7.5-4.3 7.5-7.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M12 16a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            Focus Areas
                          </h5>
                          <ul className="space-y-2">
                            {getTierFocusAreas(userTier).map((area, index) => (
                              <li key={index} className="flex items-start gap-2 text-sm">
                                <span className="text-[#103138] mt-1">•</span>
                                <span className="text-[#103138]/80">{area}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-6 bg-gray-50 border-t border-gray-100">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-[#103138]">Next Steps</h4>
                        <button onClick={() => handleTabChange('Strategic Action Plan')} className="text-sm text-[#20E28F] font-medium hover:text-[#103138] transition-colors flex items-center gap-1">
                          View Action Plan
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      </div>
                      <p className="text-sm text-[#103138]/70 mt-2">
                        Explore your detailed results and recommendations in the sections of this report. We've created a personalized action plan to help advance your AI maturity.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {activeTab === 'Key Findings' && (
                <KeyFindingsSection 
                  markdownContent={reportMarkdown || ''}
                />
              )}
              
              {activeTab === 'Recommendations' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-bold text-[#103138] mb-4 flex items-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-3 text-[#20E28F]">
                      <path d="M9 6H20M9 12H20M9 18H20M5 6V6.01M5 12V12.01M5 18V18.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Recommendations & Next Steps
                  </h2>
                  
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
                    <h3 className="text-lg font-semibold mb-4 text-[#103138] flex items-center">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2 text-[#20E28F]">
                        <path d="M12 8V16M8 12H16M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" 
                          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Key Recommendations Based on Your Assessment
                    </h3>
                    <p className="text-[#103138]/80 leading-relaxed mb-4">
                      Based on your assessment results, we've identified the following recommendations to help your organization
                      advance its AI maturity. These action items are tailored to your specific needs and current capabilities.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {actionItems && actionItems.length > 0 ? (
                      actionItems.map((action, index) => (
                        <div key={`action-${index}`} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:border-[#20E28F]/20 transition-colors overflow-hidden group">
                          <div className="p-1 bg-gradient-to-r from-[#20E28F]/10 to-[#F3FDF5]/50"></div>
                          <div className="p-5">
                            <div className="flex items-start gap-4 mb-3">
                              <div className="w-8 h-8 rounded-lg bg-[#F3FDF5] flex items-center justify-center text-[#20E28F] flex-shrink-0">
                                <span className="font-bold">{index + 1}</span>
                              </div>
                              <h4 className="font-semibold text-[#103138] group-hover:text-[#20E28F] transition-colors leading-tight pt-1">
                                {action}
                              </h4>
                            </div>
                            <div className="ml-12 text-sm text-[#103138]/70">
                              {getRecommendationDescription(index, action)}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-2 bg-gray-50 p-8 rounded-lg text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        <h3 className="text-lg font-medium text-gray-500 mb-2">No Recommendations Found</h3>
                        <p className="text-gray-400 max-w-md mx-auto">
                          We couldn't extract specific recommendations from your assessment.
                          Please contact support for personalized guidance.
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="bg-[#F3FDF5]/50 rounded-xl p-5 border border-[#20E28F]/20">
                    <h4 className="font-semibold text-[#103138] mb-3 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-[#20E28F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Implementation Tips
                    </h4>
                    <p className="text-sm text-[#103138]/80 mb-2">
                      For best results, prioritize these recommendations based on your organization's specific goals and constraints.
                      Consider forming cross-functional teams to implement these changes effectively.
                    </p>
                    <p className="text-sm text-[#103138]/80">
                      For a more detailed action plan, see the Strategic Action Plan section of this report.
                    </p>
                  </div>
                </div>
              )}
              
              {activeTab === 'Strategic Action Plan' && (
                <StrategicActionPlanSection
                  reportMarkdown={reportMarkdown}
                />
              )}
              
              {activeTab === 'Detailed Analysis' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-bold text-[#103138] mb-4 flex items-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-3 text-[#20E28F]">
                      <path d="M10 9H6M15.5 11C13.567 11 12 9.433 12 7.5C12 5.567 13.567 4 15.5 4C17.433 4 19 5.567 19 7.5C19 9.433 17.433 11 15.5 11ZM6.5 21C4.567 21 3 19.433 3 17.5C3 15.567 4.567 14 6.5 14C8.433 14 10 15.567 10 17.5C10 19.433 8.433 21 6.5 21ZM18 16.5H14M18 19.5H14M6 6L10 6" 
                        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    Detailed Analysis
                  </h2>
                  
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
                    <h3 className="text-xl font-semibold mb-4 text-[#103138] flex items-center">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2 text-[#20E28F]">
                        <path d="M2 5.25A2.25 2.25 0 014.25 3h15.5A2.25 2.25 0 0122 5.25v13.5A2.25 2.25 0 0119.75 21H4.25A2.25 2.25 0 012 18.75V5.25z" 
                          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M9 3v18M9 15h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Comprehensive AI Maturity Breakdown
                    </h3>
                    <p className="text-[#103138]/80 leading-relaxed mb-4">
                      This analysis breaks down your assessment results across key dimensions of AI maturity.
                      Each dimension is evaluated based on your responses and includes specific insights for improvement.
                    </p>
                    
                    {userTier && (
                      <div className="mt-4 p-4 bg-[#F3FDF5] rounded-lg">
                        <p className="font-medium flex items-center">
                          <span className="w-3 h-3 rounded-full bg-[#20E28F] mr-2 flex-shrink-0"></span>
                          <span className="text-[#20E28F] font-semibold mr-2">Current AI Maturity Tier:</span> 
                          <span className="text-[#103138]">{userTier}</span>
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {reportMarkdown ? (
                    <DetailedAnalysisSection reportMarkdown={reportMarkdown} tier={userTier} />
                  ) : (
                    <div className="bg-gray-50 p-8 rounded-lg text-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      <h3 className="text-lg font-medium text-gray-500 mb-2">No Detailed Analysis Found</h3>
                      <p className="text-gray-400 max-w-md mx-auto">
                        We couldn't locate a detailed analysis section in your assessment report.
                        Please contact support for assistance.
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              {activeTab === 'Benchmarks' && (
                <BenchmarksSection
                  reportMarkdown={reportMarkdown}
                  tier={userTier}
                />
              )}
              
              {activeTab === 'Assessment Q&A' && (
                <QAndASection
                  questionAnswerHistory={questionAnswerHistory}
                />
              )}
              
              {activeTab === 'Learning Path' && (
                <LearningPathSection
                  reportMarkdown={reportMarkdown}
                  tier={userTier}
                />
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-white p-6">
          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-6 rounded-lg max-w-lg w-full mb-6">
            <h2 className="text-2xl font-bold mb-3 text-yellow-700">Report Not Found</h2>
            <p className="text-sg-dark-teal/70 mb-6">
              We couldn't find your report data. Would you like to return to the homepage and start a new assessment?
            </p>
            <button 
              onClick={() => window.location.href = '/'}  
              className="px-6 py-3 bg-sg-dark-teal text-white font-semibold rounded-lg shadow-sm hover:brightness-105 transition-all"
            >
              Return to Home
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        
        body {
          background-color: ${colors.lightMint};
          color: ${colors.darkTeal};
        }
        
        .results-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        
        .header {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          padding: 1rem 2rem;
          position: sticky;
          top: 0;
          z-index: 10;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
          border-bottom: 1px solid rgba(0, 0, 0, 0.04);
        }
        
        .header-content {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .header h1 {
          color: ${colors.darkTeal};
          font-weight: 700;
          margin-left: 0.5rem;
          font-size: 1.3rem;
        }
        
        .logo-container {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: linear-gradient(135deg, ${colors.brightGreen}, ${colors.lightBlue});
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 10px rgba(32, 226, 143, 0.2);
        }
        
        .logo-inner {
          color: ${colors.darkTeal};
          font-weight: 800;
          font-size: 18px;
        }
        
        .header-actions {
          display: flex;
          gap: 12px;
        }
        
        .btn-primary {
          background-color: ${colors.brightGreen};
          color: white;
          border: none;
          padding: 0.6rem 1.2rem;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 2px 8px rgba(32, 226, 143, 0.25);
          font-size: 0.875rem;
        }
        
        .btn-primary:hover {
          background-color: #1CC47E;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(32, 226, 143, 0.35);
        }
        
        .btn-secondary {
          background-color: white;
          color: ${colors.darkTeal};
          border: 1px solid rgba(16, 49, 56, 0.15);
          padding: 0.6rem 1.2rem;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.875rem;
        }
        
        .btn-secondary:hover {
          border-color: rgba(16, 49, 56, 0.3);
          background-color: rgba(16, 49, 56, 0.02);
        }
        
        .main-content {
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 2rem;
          max-width: 1280px;
          margin: 2rem auto;
          padding: 0 2rem;
          flex-grow: 1;
          height: calc(100vh - 120px); /* Set explicit height for container */
        }
        
        .sidebar {
          background: ${colors.white};
          border-radius: 16px;
          padding: 1.5rem;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
          height: fit-content;
          position: sticky;
          top: 100px;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          max-height: calc(100vh - 120px); /* Match parent container height */
          overflow-y: auto; /* Allow sidebar to scroll if content exceeds height */
        }
        
        .tier-indicator {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 0.5rem;
        }
        
        .tier-circle {
          width: 120px;
          height: 120px;
          border-radius: 50%;
          background: ${colors.white};
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
          margin-bottom: 1rem;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
        }
        
        .tier-circle::before {
          content: '';
          position: absolute;
          top: -4px;
          right: -4px;
          bottom: -4px;
          left: -4px;
          background: linear-gradient(135deg, ${colors.brightGreen}, ${colors.lightBlue});
          border-radius: 50%;
          z-index: -1;
        }
        
        .tier-text {
          background: linear-gradient(90deg, ${colors.darkTeal}, ${colors.brightGreen});
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          font-size: 1.75rem;
          font-weight: 700;
        }
        
        .tier-label {
          color: ${colors.darkTeal}cc;
          font-size: 0.8rem;
          margin-top: 0.5rem;
          font-weight: 500;
        }
        
        .tier-progress {
          background: ${colors.white};
          border-radius: 12px;
          padding: 1.2rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
          border: 1px solid rgba(0, 0, 0, 0.03);
        }
        
        .tier-progress-label {
          font-size: 0.8rem;
          font-weight: 600;
          color: ${colors.darkTeal};
          margin-bottom: 0.8rem;
        }
        
        .tier-progress-bar {
          height: 8px;
          background: ${colors.lightMint};
          border-radius: 4px;
          position: relative;
          margin-bottom: 0.8rem;
          overflow: hidden;
        }
        
        .tier-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, ${colors.brightGreen}, #5de4b1);
          border-radius: 4px;
          transition: width 1s ease-in-out;
          box-shadow: 0 0 8px rgba(32, 226, 143, 0.4);
        }
        
        .tier-progress-labels {
          display: flex;
          justify-content: space-between;
          font-size: 0.7rem;
          color: ${colors.darkTeal}99;
          font-weight: 500;
        }
        
        .nav-menu {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        
        .nav-section-title {
          font-size: 0.8rem;
          font-weight: 700;
          color: ${colors.darkTeal}cc;
          margin-bottom: 0.3rem;
          padding-left: 0.5rem;
        }
        
        .nav-item {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          padding: 0.8rem 1rem;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 500;
          color: ${colors.darkTeal}dd;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        
        .nav-item:hover {
          background: ${colors.lightMint}66;
        }
        
        .nav-item.active {
          background: ${colors.lightMint};
          color: ${colors.brightGreen};
          font-weight: 600;
        }
        
        .nav-item svg {
          color: inherit;
        }
        
        .user-info {
          margin-top: auto;
          padding-top: 1rem;
          border-top: 1px solid rgba(0, 0, 0, 0.06);
        }
        
        .user-info-label {
          font-size: 0.7rem;
          color: ${colors.darkTeal}99;
          margin-bottom: 0.3rem;
        }
        
        .user-info-name {
          font-size: 0.9rem;
          font-weight: 600;
          color: ${colors.darkTeal};
        }
        
        .content-panel {
          background: ${colors.lightMint}33;
          border-radius: 16px;
          padding: 2rem;
          overflow-y: auto;
          height: calc(100vh - 120px);
          transition: opacity 0.3s ease;
          box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.01);
        }
        
        .content-panel.fade-out {
          opacity: 0;
        }
        
        .content-panel.fade-in {
          opacity: 1;
        }
        
        /* Common Card Styles */
        .card {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
          overflow: hidden;
          transition: all 0.2s ease;
        }
        
        .card:hover {
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
          transform: translateY(-2px);
        }
        
        .card-header {
          padding: 1.25rem;
          border-bottom: 1px solid rgba(0, 0, 0, 0.05);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .card-title {
          font-size: 1.1rem;
          font-weight: 600;
          color: ${colors.darkTeal};
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .card-body {
          padding: 1.25rem;
        }
        
        .card-footer {
          padding: 1rem 1.25rem;
          background: ${colors.lightMint}33;
          border-top: 1px solid rgba(0, 0, 0, 0.05);
          font-size: 0.875rem;
        }
        
        /* Typography */
        .section-title {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          font-size: 1.8rem;
          font-weight: 700;
          color: ${colors.darkTeal};
          margin-bottom: 1.5rem;
        }
        
        .section-subtitle {
          font-size: 1.4rem;
          font-weight: 600;
          color: ${colors.darkTeal};
          margin-bottom: 1rem;
          margin-top: 2rem;
        }
        
        .text-primary {
          color: ${colors.brightGreen};
        }
        
        .text-secondary {
          color: ${colors.darkTeal}aa;
        }
        
        .text-sm {
          font-size: 0.875rem;
        }
        
        /* Badges */
        .badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          border-radius: 30px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .badge-primary {
          background: ${colors.lightMint};
          color: ${colors.brightGreen};
        }
        
        .badge-secondary {
          background: ${colors.cream1};
          color: ${colors.orange};
        }
        
        /* Lists */
        .feature-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin: 1rem 0;
        }
        
        .feature-item {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
        }
        
        .feature-icon {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: ${colors.lightMint};
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: ${colors.brightGreen};
        }
        
        .feature-text {
          color: ${colors.darkTeal}dd;
          line-height: 1.5;
          font-size: 0.95rem;
        }
        
        /* Gradients & Dividers */
        .gradient-top-border {
          position: relative;
        }
        
        .gradient-top-border::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, ${colors.brightGreen}, ${colors.lightBlue});
          border-radius: 4px 4px 0 0;
        }
        
        .divider {
          height: 1px;
          background: rgba(0, 0, 0, 0.05);
          margin: 1.5rem 0;
        }
        
        /* Tables */
        .table-container {
          overflow-x: auto;
          margin: 1.5rem 0;
        }
        
        .data-table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .data-table th {
          background: ${colors.lightMint}55;
          padding: 0.75rem 1rem;
          text-align: left;
          font-weight: 600;
          color: ${colors.darkTeal};
          font-size: 0.875rem;
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
        }
        
        .data-table td {
          padding: 0.75rem 1rem;
          border-bottom: 1px solid rgba(0, 0, 0, 0.05);
          color: ${colors.darkTeal}dd;
          font-size: 0.875rem;
        }
        
        .data-table tr:last-child td {
          border-bottom: none;
        }
        
        .data-table tr:hover td {
          background: ${colors.lightMint}22;
        }
        
        /* Accordions */
        .accordion {
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 8px;
          overflow: hidden;
          margin-bottom: 1rem;
        }
        
        .accordion-header {
          padding: 1rem;
          background: white;
          font-weight: 600;
          color: ${colors.darkTeal};
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .accordion-body {
          padding: 0 1rem 1rem 1rem;
          color: ${colors.darkTeal}dd;
          font-size: 0.95rem;
          line-height: 1.6;
        }
        
        /* Alerts */
        .alert {
          padding: 1rem;
          border-radius: 8px;
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          margin: 1rem 0;
        }
        
        .alert-info {
          background: ${colors.lightMint}44;
          border-left: 4px solid ${colors.brightGreen};
        }
        
        .alert-warning {
          background: ${colors.cream1};
          border-left: 4px solid ${colors.orange};
        }
        
        .alert-icon {
          width: 24px;
          height: 24px;
          flex-shrink: 0;
        }
        
        .alert-content {
          flex: 1;
        }
        
        .alert-title {
          font-weight: 600;
          margin-bottom: 0.25rem;
        }
        
        .alert-text {
          font-size: 0.875rem;
          line-height: 1.5;
        }
        
        /* General spacing utilities */
        .mt-2 { margin-top: 0.5rem; }
        .mt-4 { margin-top: 1rem; }
        .mt-6 { margin-top: 1.5rem; }
        .mt-8 { margin-top: 2rem; }
        
        .mb-2 { margin-bottom: 0.5rem; }
        .mb-4 { margin-bottom: 1rem; }
        .mb-6 { margin-bottom: 1.5rem; }
        .mb-8 { margin-bottom: 2rem; }
        
        /* Additional responsive styles */
        @media (max-width: 1024px) {
          .main-content {
            grid-template-columns: 240px 1fr;
            padding: 0 1rem;
          }
          
          .content-panel {
            padding: 1.5rem;
          }
        }
        
        @media (max-width: 768px) {
          .main-content {
            grid-template-columns: 1fr;
            gap: 1rem;
          }
          
          .sidebar {
            position: relative;
            top: 0;
            max-height: none;
            height: auto;
            overflow-y: hidden;
          }
          
          .content-panel {
            height: auto;
            max-height: none;
          }
          
          .insights-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
