import { NextResponse, NextRequest } from 'next/server';
import aiManager from '@/lib/ai-providers';

// Define ScorecardHistoryEntry interface for type safety
type AnswerSourceType = 'Groq Llama 3 8B' | 'Pollinations Fallback' | 'Groq API Failed' | 'Fallback Failed' | 'Manual' | 'OpenAI';
interface ScorecardHistoryEntry {
  question: string;
  answer: any;
  phaseName?: string;
  answerType?: string;
  options?: string[] | null;
  reasoningText?: string | null;
  answerSource?: AnswerSourceType;
}

// Define assessment phases and maximum questions
const ASSESSMENT_PHASES = ['Strategy & Goals', 'Data Readiness', 'Technology & Tools', 'Team Skills & Process', 'Governance & Measurement'];
const MAX_QUESTIONS = 20; // Set back to 20 questions

// Immediately run verification of tier calculation on module load
// Run this once when the module is loaded
console.log('>>> BACKEND: Running immediate tier verification on module load');
setTimeout(() => {
  try {
    console.log('>>> BACKEND: Starting immediate verification test...');
    verifyTierCalculation();
    console.log('>>> BACKEND: Completed immediate verification test');
  } catch (error) {
    console.error('>>> BACKEND: Error in immediate verification test:', error);
  }
}, 500);

// Pollinations API base URL
const POLLINATIONS_API_URL = "https://text.pollinations.ai/openai";

// Basic scoring logic (needs refinement based on actual questions)
function calculateTierScore(history: ScorecardHistoryEntry[]): number {
  let totalScore = 0;
  const MAX_POSSIBLE_SCORE = 100; // Maximum possible score (20 questions × max 5 points each)
  
  // Add debug logging
  console.log('>>> BACKEND: Starting tier calculation with history length:', history.length);
  console.log('>>> BACKEND: DETAILED TIER CALCULATION ANALYSIS >>>');
  
  // Debug: Log all questions and answers for analysis
  history.forEach((entry, index) => {
    console.log(`>>> BACKEND: Q${index + 1} [${entry.answerType}]: "${entry.question.substring(0, 50)}..." = ${typeof entry.answer === 'string' ? entry.answer : JSON.stringify(entry.answer)}`);
    if (entry.answerSource) {
      console.log(`>>> BACKEND: Q${index + 1} Answer Source: ${entry.answerSource}`);
    }
  });

  for (const entry of history) {
    let questionScore = 0;
    let scoringReason = '';
    
    // Assign points based on answer type and value
    if (entry.answerType === 'scale' && typeof entry.answer === 'string') {
      const scaleValue = parseInt(entry.answer, 10);
      if (!isNaN(scaleValue)) {
        // Scale values (typically 1-5) are now weighted more heavily
        // 1 = 1pt, 2 = 2pts, 3 = 3pts, 4 = 4pts, 5 = 5pts
        questionScore = scaleValue;
        scoringReason = `Scale value ${scaleValue}`;
      }
    } else if (entry.answerType === 'radio' && typeof entry.answer === 'string') {
      // Enhanced scoring for radio buttons with more sophisticated pattern matching
      const answerLower = entry.answer.toLowerCase();
      
      // Leader-level keywords
      if (
        answerLower.includes('advanced') || 
        answerLower.includes('extensive') || 
        answerLower.includes('strategic') || 
        answerLower.includes('comprehensive') ||
        answerLower.includes('integrated') ||
        answerLower.includes('sophisticated') ||
        answerLower.includes('enterprise') ||
        answerLower.includes('mature') ||
        answerLower.includes('automated') ||
        answerLower.includes('ai-driven') ||
        answerLower.includes('predictive')
      ) {
        questionScore = 5; // Maximum points for Leader-level answers
        scoringReason = 'Contains Leader-level keywords';
      }
      // Enabler-level keywords
      else if (
        answerLower.includes('some') || 
        answerLower.includes('moderate') ||
        answerLower.includes('developing') ||
        answerLower.includes('improving') ||
        answerLower.includes('established') ||
        answerLower.includes('regular') ||
        answerLower.includes('multiple') ||
        answerLower.includes('organized') ||
        answerLower.includes('consistent')
      ) {
        questionScore = 3; // Medium points for Enabler-level answers
        scoringReason = 'Contains Enabler-level keywords';
      }
      // Dabbler-level keywords - EXPANDED LIST
      else if (
        answerLower.includes('basic') || 
        answerLower.includes('limited') ||
        answerLower.includes('minimal') ||
        answerLower.includes('occasional') ||
        answerLower.includes('beginning') ||
        answerLower.includes('early') ||
        answerLower.includes('exploring') ||
        answerLower.includes('ad hoc') ||
        answerLower.includes('manual') ||
        answerLower.includes('no ') ||
        answerLower.includes('not ') ||
        answerLower.includes('don\'t') ||
        // Additional Dabbler keywords
        answerLower.includes('experimenting') ||
        answerLower.includes('testing') ||
        answerLower.includes('rarely') ||
        answerLower.includes('initial') ||
        answerLower.includes('starting') ||
        answerLower.includes('considering') ||
        answerLower.includes('planning') ||
        answerLower.includes('yet to') ||
        answerLower.includes('haven\'t') ||
        answerLower.includes('unsure') ||
        answerLower.includes('uncertain') ||
        answerLower.includes('beginner') ||
        answerLower.includes('introduction') ||
        answerLower.includes('introductory') ||
        answerLower.includes('foundation') ||
        answerLower.includes('preliminary')
      ) {
        questionScore = 1; // Minimum points for Dabbler-level answers
        scoringReason = 'Contains Dabbler-level keywords';
      }
      else {
        // Default for other radio answers that don't match specific patterns
        questionScore = 2; // Lowered default score to better differentiate
        scoringReason = 'Default radio answer (no specific keywords matched)';
      }
    } else if (entry.answerType === 'checkbox' && Array.isArray(entry.answer)) {
      // More sophisticated checkbox scoring
      // Base score on number of selected options, but with diminishing returns
      const numOptions = entry.answer.length;
      
      // More options generally indicates more comprehensive implementation
      if (numOptions === 0) {
        questionScore = 0;
        scoringReason = 'No options selected';
      } else if (numOptions === 1) {
        questionScore = 1; // Single option = basic/minimal (Dabbler)
        scoringReason = 'Single option selected (Dabbler-level)';
      } else if (numOptions === 2) {
        questionScore = 2; // Two options = developing (Dabbler-Enabler)
        scoringReason = 'Two options selected (Dabbler-Enabler level)';
      } else if (numOptions === 3) {
        questionScore = 3; // Three options = established (Enabler)
        scoringReason = 'Three options selected (Enabler-level)';
      } else if (numOptions === 4) {
        questionScore = 4; // Four options = comprehensive (Enabler-Leader)
        scoringReason = 'Four options selected (Enabler-Leader level)';
      } else {
        questionScore = 5; // Five+ options = extensive (Leader)
        scoringReason = 'Five or more options selected (Leader-level)';
      }
      
      // Also analyze the content of selected options
      let leaderKeywordCount = 0;
      let dabblerKeywordCount = 0;
      
      for (const option of entry.answer) {
        const optionLower = option.toLowerCase();
        
        // Count Leader-level keywords in options
        if (
          optionLower.includes('advanced') || 
          optionLower.includes('extensive') ||
          optionLower.includes('strategic') ||
          optionLower.includes('ai-driven') ||
          optionLower.includes('predictive') ||
          optionLower.includes('automated') ||
          // Add more Leader-specific option keywords
          optionLower.includes('enterprise') ||
          optionLower.includes('integrated') ||
          optionLower.includes('sophisticated') ||
          optionLower.includes('comprehensive') ||
          optionLower.includes('machine learning') ||
          optionLower.includes('neural') ||
          optionLower.includes('optimize') ||
          optionLower.includes('transform')
        ) {
          leaderKeywordCount++;
        }
        
        // Count Dabbler-level keywords in options
        if (
          optionLower.includes('basic') || 
          optionLower.includes('limited') ||
          optionLower.includes('minimal') ||
          optionLower.includes('manual') ||
          // Add more Dabbler-specific option keywords
          optionLower.includes('simple') ||
          optionLower.includes('occasional') ||
          optionLower.includes('beginning') ||
          optionLower.includes('introduction') ||
          optionLower.includes('initial') ||
          optionLower.includes('trial') ||
          optionLower.includes('testing') ||
          optionLower.includes('single') ||
          optionLower.includes('rarely')
        ) {
          dabblerKeywordCount++;
        }
      }
      
      // Adjust score based on the content of selected options - MORE AGGRESSIVE ADJUSTMENT
      if (leaderKeywordCount > 0) {
        const leaderBoost = Math.min(2, leaderKeywordCount); // More aggressive boost for Leader options
        questionScore = Math.min(5, questionScore + leaderBoost);
        scoringReason += `, boosted for ${leaderKeywordCount} Leader-level keywords (+${leaderBoost})`;
      }
      if (dabblerKeywordCount > 0 && questionScore > 1) {
        const dabblerReduction = Math.min(2, dabblerKeywordCount); // More aggressive reduction for Dabbler options
        questionScore = Math.max(1, questionScore - dabblerReduction);
        scoringReason += `, reduced for ${dabblerKeywordCount} Dabbler-level keywords (-${dabblerReduction})`;
      }
    } else if (entry.answerType === 'text' && typeof entry.answer === 'string') {
      // Text answers are harder to score automatically, but we can look for key patterns
      const textLower = entry.answer.toLowerCase();
      const textLength = entry.answer.length;
      
      // Very short answers typically indicate less sophistication
      if (textLength < 30) {
        questionScore = 1; // Very short = basic (Dabbler)
        scoringReason = 'Very short text response (<30 chars, Dabbler-level)';
      } else if (textLength < 80) {
        questionScore = 2; // Short = developing (Dabbler-Enabler)
        scoringReason = 'Short text response (30-80 chars, Dabbler-Enabler level)';
      } else if (textLength < 150) {
        questionScore = 3; // Medium = established (Enabler)
        scoringReason = 'Medium text response (80-150 chars, Enabler-level)';
      } else {
        questionScore = 4; // Long = comprehensive (Leader)
        scoringReason = 'Long text response (>150 chars, Leader-level)';
      }
      
      // Look for Leader-level keywords in text answers
      if (
        textLower.includes('strategy') || 
        textLower.includes('strategic') ||
        textLower.includes('comprehensive') ||
        textLower.includes('integrated') ||
        textLower.includes('enterprise') ||
        textLower.includes('advanced') ||
        textLower.includes('automated') ||
        textLower.includes('ai-driven') ||
        textLower.includes('predictive') ||
        textLower.includes('machine learning') ||
        textLower.includes('deep learning') ||
        textLower.includes('neural') ||
        textLower.includes('transform')
      ) {
        questionScore = Math.min(5, questionScore + 1); // Boost for Leader-level keywords
        scoringReason += ', boosted for Leader-level keywords';
      }
      
      // Look for Dabbler-level indicators in text answers - EXPANDED LIST
      if (
        textLower.includes('basic') || 
        textLower.includes('limited') ||
        textLower.includes('minimal') ||
        textLower.includes('beginning') ||
        textLower.includes('starting') ||
        textLower.includes('not sure') ||
        textLower.includes('don\'t know') ||
        textLower.includes('haven\'t') ||
        textLower.includes('no ') ||
        textLower.includes('not ') ||
        // Additional Dabbler text indicators
        textLower.includes('i\'m new') ||
        textLower.includes('we\'re new') ||
        textLower.includes('just started') ||
        textLower.includes('initial stages') ||
        textLower.includes('exploring') ||
        textLower.includes('considering') ||
        textLower.includes('experimenting') ||
        textLower.includes('testing') ||
        textLower.includes('trial') ||
        textLower.includes('simple') ||
        textLower.includes('occasional') ||
        textLower.includes('ad hoc') ||
        textLower.includes('rarely') ||
        textLower.includes('manual') ||
        textLower.includes('unsure') ||
        textLower.includes('uncertain') ||
        textLower.includes('unfamiliar') ||
        textLower.includes('learning about') ||
        textLower.includes('not adopted') ||
        textLower.includes('not implemented') ||
        textLower.includes('not utilizing')
      ) {
        // More aggressive reduction for Dabbler text
        const negativeMatches = textLower.match(/(no |not |haven't|don't)/g);
        if (negativeMatches && negativeMatches.length > 1) {
          // Multiple negative indicators mean very low score
          questionScore = 1;
          scoringReason += ', reduced to minimum for multiple negative Dabbler indicators';
        } else {
          questionScore = Math.max(1, questionScore - 2); // Stronger reduction for Dabbler-level indicators
          scoringReason += ', reduced for Dabbler-level keywords (-2)';
        }
      }
    }
    
    // Add the question score to the total
    totalScore += questionScore;
    console.log(`>>> BACKEND: Q${history.indexOf(entry) + 1} [${entry.answerType}] scored ${questionScore} points (${scoringReason}) - Answer: "${typeof entry.answer === 'string' ? entry.answer.substring(0, 50) : JSON.stringify(entry.answer).substring(0, 50)}${(typeof entry.answer === 'string' && entry.answer.length > 50) || (typeof entry.answer !== 'string' && JSON.stringify(entry.answer).length > 50) ? '...' : ''}"`);
  }

  // Normalize the score if we have fewer than MAX_QUESTIONS
  // This ensures fair comparison regardless of how many questions were answered
  if (history.length > 0 && history.length < MAX_QUESTIONS) {
    const normalizationFactor = MAX_QUESTIONS / history.length;
    const normalizedScore = Math.round(totalScore * normalizationFactor);
    console.log(`>>> BACKEND: Normalizing score: ${totalScore} × ${normalizationFactor} = ${normalizedScore}`);
    return normalizedScore;
  }

  console.log(`>>> BACKEND: Final score: ${totalScore} / ${MAX_POSSIBLE_SCORE}`);
  console.log(`>>> BACKEND: Current thresholds: Dabbler (0-${DABBLER_MAX_SCORE}), Enabler (${DABBLER_MAX_SCORE+1}-${ENABLER_MAX_SCORE}), Leader (${ENABLER_MAX_SCORE+1}+)`);
  
  // Final safety check: If a high percentage of answers contain Dabbler keywords but score is above threshold,
  // adjust score to ensure it's classified as Dabbler
  const dabblerKeywordPattern = /(basic|limited|minimal|occasional|beginning|early|exploring|ad hoc|manual|no |not |don't|haven't|unsure|just started|considering|testing|trial)/i;
  let dabblerKeywordCount = 0;
  
  for (const entry of history) {
    const answerStr = typeof entry.answer === 'string' 
      ? entry.answer 
      : Array.isArray(entry.answer) 
        ? entry.answer.join(' ') 
        : JSON.stringify(entry.answer);
    
    if (dabblerKeywordPattern.test(answerStr)) {
      dabblerKeywordCount++;
    }
  }
  
  const dabblerKeywordPercentage = history.length > 0 ? (dabblerKeywordCount / history.length) * 100 : 0;
  console.log(`>>> BACKEND: Dabbler keyword percentage: ${dabblerKeywordPercentage.toFixed(2)}% (${dabblerKeywordCount}/${history.length} answers)`);
  
  // If more than 60% of answers contain Dabbler keywords but score is above Dabbler threshold,
  // apply a correction to ensure it's classified as Dabbler
  if (dabblerKeywordPercentage >= 60 && totalScore > DABBLER_MAX_SCORE && totalScore <= DABBLER_MAX_SCORE + 10) {
    const adjustedScore = DABBLER_MAX_SCORE;
    console.log(`>>> BACKEND: SAFETY CHECK ACTIVATED: High percentage of Dabbler keywords detected (${dabblerKeywordPercentage.toFixed(2)}%).`);
    console.log(`>>> BACKEND: Adjusting score from ${totalScore} to ${adjustedScore} to ensure Dabbler classification`);
    totalScore = adjustedScore;
  }
  
  const resultingTier = determineTier(totalScore);
  console.log(`>>> BACKEND: Resulting tier: ${resultingTier}`);
  console.log('>>> BACKEND: <<< END DETAILED TIER CALCULATION ANALYSIS');
  
  return totalScore;
}

// Recalibrated score thresholds based on 20 questions with max 5 points each
// These thresholds are now percentages of the max possible score (100)
const DABBLER_MAX_SCORE = 50; // 50% - Previously 40%, increased to account for Dabbler answers scoring higher
const ENABLER_MAX_SCORE = 75; // 75% - Previously 70%, increased to maintain separation between tiers
// Leader is anything above ENABLER_MAX_SCORE (>75%)

function determineTier(score: number): 'Dabbler' | 'Enabler' | 'Leader' {
  if (score <= DABBLER_MAX_SCORE) {
    return 'Dabbler';
  } else if (score <= ENABLER_MAX_SCORE) {
    return 'Enabler';
  } else {
    return 'Leader';
  }
}


// Add a helper for fetch with retry
async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delayMs = 2000) {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      lastError = new Error(`Pollinations API responded with status ${res.status}: ${await res.text()}`);
    } catch (e) {
      lastError = e;
    }
    if (i < retries - 1) await new Promise(res => setTimeout(res, delayMs));
  }
  throw lastError || new Error('fetch failed');
}

// Debug function to verify tier calculation with sample answers
function debugTierCalculation() {
  console.log('>>> BACKEND: Running tier calculation debug tests');
  
  // Sample answers for each tier
  const dabblerAnswers: ScorecardHistoryEntry[] = [
    { question: 'How would you describe your organization\'s current AI strategy?', answer: 'We have a basic understanding but no formal strategy', answerType: 'radio' },
    { question: 'How frequently does your team use AI tools?', answer: '1', answerType: 'scale' },
    { question: 'Which AI tools does your team currently use?', answer: ['Basic content generation'], answerType: 'checkbox' },
    { question: 'Describe your data collection process', answer: 'We collect some data but it\'s not organized.', answerType: 'text' },
  ];
  
  const enablerAnswers: ScorecardHistoryEntry[] = [
    { question: 'How would you describe your organization\'s current AI strategy?', answer: 'We have some strategic elements but are still developing', answerType: 'radio' },
    { question: 'How frequently does your team use AI tools?', answer: '3', answerType: 'scale' },
    { question: 'Which AI tools does your team currently use?', answer: ['Content generation', 'Email optimization', 'Basic analytics'], answerType: 'checkbox' },
    { question: 'Describe your data collection process', answer: 'We have established processes for collecting and organizing our marketing data with regular reviews.', answerType: 'text' },
  ];
  
  const leaderAnswers: ScorecardHistoryEntry[] = [
    { question: 'How would you describe your organization\'s current AI strategy?', answer: 'We have an advanced, comprehensive AI strategy integrated with business goals', answerType: 'radio' },
    { question: 'How frequently does your team use AI tools?', answer: '5', answerType: 'scale' },
    { question: 'Which AI tools does your team currently use?', answer: ['Advanced content generation', 'Predictive analytics', 'Automated personalization', 'AI-driven campaign orchestration', 'Customer journey optimization'], answerType: 'checkbox' },
    { question: 'Describe your data collection process', answer: 'We have a sophisticated, enterprise-wide data strategy with integrated AI-driven analytics and predictive modeling capabilities that inform all marketing decisions.', answerType: 'text' },
  ];
  
  // Test each set of answers
  const dabblerScore = calculateTierScore(dabblerAnswers);
  const dabblerTier = determineTier(dabblerScore);
  console.log(`>>> BACKEND DEBUG: Dabbler test - Score: ${dabblerScore}, Tier: ${dabblerTier}`);
  
  const enablerScore = calculateTierScore(enablerAnswers);
  const enablerTier = determineTier(enablerScore);
  console.log(`>>> BACKEND DEBUG: Enabler test - Score: ${enablerScore}, Tier: ${enablerTier}`);
  
  const leaderScore = calculateTierScore(leaderAnswers);
  const leaderTier = determineTier(leaderScore);
  console.log(`>>> BACKEND DEBUG: Leader test - Score: ${leaderScore}, Tier: ${leaderTier}`);
  
  return {
    dabblerTest: { score: dabblerScore, tier: dabblerTier },
    enablerTest: { score: enablerScore, tier: enablerTier },
    leaderTest: { score: leaderScore, tier: leaderTier }
  };
}

export async function POST(request: Request) {
  try {
    // Run debug tests in development
    if (process.env.NODE_ENV === 'development') {
      debugTierCalculation();
    }
    
    // Parse and validate the request body with more robust error handling
    let requestData;
    try {
      const contentType = request.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('>>> BACKEND: Invalid content type:', contentType);
        return NextResponse.json(
          { error: 'Invalid content type', message: 'Request must be application/json' },
          { status: 400 }
        );
      }
      
      const text = await request.text();
      try {
        requestData = JSON.parse(text);
      } catch (parseError) {
        console.error('>>> BACKEND: JSON parse error:', parseError);
        console.error('>>> BACKEND: Raw request body:', text.substring(0, 200) + (text.length > 200 ? '...' : ''));
        return NextResponse.json(
          { error: 'Invalid JSON', message: 'Request body is not valid JSON' },
          { status: 400 }
        );
      }
    } catch (bodyError) {
      console.error('>>> BACKEND: Error reading request body:', bodyError);
      return NextResponse.json(
        { error: 'Request body error', message: 'Failed to read request body' },
        { status: 400 }
      );
    }
    
    // CRITICAL FIX: Ensure history defaults to an empty array if it is not provided or undefined
    const { action, currentPhaseName, industry, userName } = requestData;
    const history = Array.isArray(requestData.history) ? requestData.history : [];

    // Log incoming request data
    console.log('>>> BACKEND: API Route Received:', {
     industry,
     historyLength: history.length, // Now safe to access history.length
     currentPhaseName,
     action,
     userName
   });
    console.log('>>> BACKEND: Received industry:', industry);
    
    // Check if this is a report generation request
    if (action === 'generateReport') {
      return handleReportGeneration(history as ScorecardHistoryEntry[], industry, userName);
    } else {
      // For phased Q&A logic
      if (!currentPhaseName && history.length === 0) {  // Now safe to check history.length
        // For the initial call with no phase specified, default to first phase
        const firstPhase = ASSESSMENT_PHASES[0];
        return handleAssessmentRequest(firstPhase, [], industry);
      }
      
      return handleAssessmentRequest(currentPhaseName, history as ScorecardHistoryEntry[], industry);
    }
  } catch (error) {
    console.error('Error in scorecard-ai API route:', error);
    return NextResponse.json(
      { error: 'Failed to process AI request', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function handleReportGeneration(history: ScorecardHistoryEntry[], industry: string, userName?: string) {
  try {
    // Run our debug verification tests before starting actual calculation
    console.log('>>> BACKEND: Running tier verification tests before processing actual submission');
    verifyTierCalculation();
    
    // Calculate the tier based on the weighted scoring logic
    const score = calculateTierScore(history);
    const userAITier = determineTier(score);
    console.log(`>>> BACKEND: Calculated Tier: ${userAITier} (Score: ${score})`);

    // Define rich persona descriptions and specific instructions based on the calculated tier (Part 2.1 & 2.2)
    let personaDescription = "";
    let personaInstructions = "";
    let keyFindingsInstructions = "";
    let actionPlanInstructions = "";
    let benchmarksInstructions = "";
    let learningPathInstructions = "";

    if (userAITier === 'Dabbler') {
      personaDescription = "a Marketing Manager with basic AI understanding and limited practical application. They are aware of AI but have limited practical application, using basic tools for simple tasks like content ideas or grammar checks. They have no formal AI strategy and focus on immediate, tactical challenges. Their language reflects uncertainty or a basic understanding.";
      personaInstructions = "Tailor the report for a Dabbler Marketing Manager. Use simple language, avoid overly technical jargon, and focus on foundational concepts and quick wins.";
      keyFindingsInstructions = "IMPORTANT: ALWAYS identify at least 3 specific strengths, even for beginners (e.g., 'initiative in exploring AI', 'awareness of potential', 'willingness to learn'). NEVER return 'no strengths identified'. Then highlight fundamental weaknesses. Explain the impact of weaknesses in simple terms.";
      actionPlanInstructions = "Provide foundational, easy-to-implement steps. Focus on getting started with basic tools and understanding core concepts. Include 2-4 concrete sub-steps per recommendation.";
      benchmarksInstructions = "Describe typical Dabbler practices in the industry. Clearly explain what separates them from Enablers and the first steps to move forward.";
      learningPathInstructions = "Recommend introductory resources and explain their relevance for building basic AI literacy and identifying simple use cases.";
    } else if (userAITier === 'Enabler') {
      personaDescription = "a Marketing Manager who actively uses several AI tools and is trying to integrate AI more strategically. They actively use multiple tools, seeking workflow integration. They are aware of AI's potential for personalization and efficiency. Their language reflects practical application and a desire for optimization.";
      personaInstructions = "Tailor the report for an Enabler Marketing Manager. Use practical, results-oriented language and focus on optimizing existing workflows and exploring integration.";
      keyFindingsInstructions = "Highlight practical strengths and areas for optimization. Explain the impact of weaknesses on efficiency and scalability.";
      actionPlanInstructions = "Provide actionable steps to optimize existing AI use and integrate tools. Focus on campaign optimization, better segmentation, and proving ROI. Include 2-4 concrete sub-steps per recommendation.";
      benchmarksInstructions = "Describe typical Enabler practices in the industry. Clearly explain what separates them from Leaders and the steps to reach the next level.";
      learningPathInstructions = "Recommend resources for intermediate users, focusing on workflow integration, specific tool applications, and measuring ROI.";
    } else { // Leader
      personaDescription = "a Marketing Manager driving AI strategy for a department, overseeing integrated AI solutions for hyper-personalization, predictive analytics, and AI-driven campaign orchestration. They focus on ROI, scalability, and competitive advantage. Their language is strategic, data-driven, and demonstrates a sophisticated understanding.";
      personaInstructions = "Tailor the report for a Leader Marketing Manager. Use strategic, visionary, and data-driven language. Focus on advanced strategies, scaling innovation, and maintaining competitive advantage.";
      keyFindingsInstructions = "Highlight strategic strengths and areas for market disruption or competitive advantage. Explain the impact of weaknesses on innovation and scalability at an enterprise level.";
      actionPlanInstructions = "Provide advanced, strategic steps for scaling AI, driving innovation, and building AI-first teams. Focus on hyper-personalization at scale, predictive analytics, and market disruption. Include 2-4 concrete sub-steps per recommendation.";
      benchmarksInstructions = "Describe typical Leader practices in the industry. Highlight cutting-edge initiatives and strategic approaches that define excellence.";
      learningPathInstructions = "Recommend advanced resources, focusing on strategic AI deployment, governance, and staying ahead of the curve.";
    }

    // Create the system prompt for report generation, injecting the calculated tier and persona
    const systemPrompt = `You are an expert AI consultant specializing in helping organizations assess and improve their AI maturity and efficiency. 
${userName ? `You're preparing a personalized report for ${userName}, who is ${personaDescription} in the ${industry} industry.` : `You're preparing a report for an organization in the ${industry} industry, whose profile aligns with that of ${personaDescription}.`}
Based on the assessment questions and answers provided, your task is to generate a comprehensive AI Efficiency Scorecard report tailored specifically for a **${userAITier} Marketing Manager** in the **${industry}** industry.
Crucially, you MUST ONLY output the content of the report itself. DO NOT include any introductory or concluding remarks, disclaimers, signatures, or promotional content of any kind, including for other products or services.

EXTREMELY IMPORTANT: DO NOT include ANY advertisements, promotional content, external links, redirects, or references to other AI tools or services (such as Homestyler, Wren AI, or any other pollinations.ai redirects). Your output must be 100% free of such content. The report MUST END with your Learning Path section, with NO additional content whatsoever.

Generate the report adhering STRICTLY to the following structure and tailoring the content to the **${userAITier}** persona and **${industry}** industry. Follow these specific instructions for each section:

## Overall Tier: ${userAITier}

## Key Findings
${keyFindingsInstructions}

**Strengths:**
- CRITICALLY IMPORTANT: ALWAYS identify and list at least 3-5 key strengths, even for Dabbler tier. NEVER return "no strengths identified". For beginners, focus on positive starting points like "initiative in exploring AI," "awareness of potential," "willingness to learn," etc.
- For each strength, provide a 1-2 sentence elaboration. Use specific examples and details from the user's answers. Focus on tangible capabilities or practices that position them well for AI adoption, and explain why each is valuable in the context of the ${industry} industry.

**Weaknesses:**
- List at least 3-5 key weaknesses or improvement areas, each with a brief explanation of its potential impact on AI efficiency or marketing/sales efforts. Be constructive but honest, and connect weaknesses to the ${industry} context where possible.

## Strategic Action Plan
${actionPlanInstructions}

Provide a detailed, step-by-step action plan tailored to the user's tier and identified weaknesses. For this section:
  - Give at least 3-5 primary actionable recommendations, each targeting a specific improvement area.
  - For each recommendation, generate 2-4 specific, concrete sub-steps or examples of how the user could implement it.
  - MANDATE the integration of industry-specific use cases and advice for the ${industry} sector.
  - Ensure these actions are practical, detailed, and directly address the user's context.

## Getting Started & Resources

### Sample AI Goal-Setting Meeting Agenda
1. Generate a 3-4 point sample agenda specifically for the ${industry} sector, focusing on relevant AI adoption priorities.
2. Include specific discussion topics and measurable outcomes/next steps.

### Example Prompts for ${industry} Marketing Managers
- Create 2-3 actual example prompts that a marketing manager in ${industry} could immediately use.
- Format as "PROMPT: [actual prompt text]" and "USE CASE: [brief explanation]".

### Basic AI Data Audit Process Outline
1. Outline 3-4 key steps for conducting a basic AI data audit specifically relevant to ${industry} organizations.

## Illustrative Benchmarks
${benchmarksInstructions}

For the ${industry} industry, provide detailed, industry-specific benchmarks for ALL three tiers. Make sure each benchmark is HIGHLY RELEVANT to the ${industry} sector, with specific examples of tools, practices, or use cases that would be meaningful to organizations in this industry:

### Dabbler Tier Organizations
- Describe 2-3 concrete, realistic examples of how "Dabbler" tier organizations in ${industry} typically approach AI integration.
- Include specific tools, practices, or initial AI applications common at this tier.
- Highlight clear "first steps" or "low-hanging fruit" that ${industry} organizations at this tier typically focus on.

### Enabler Tier Organizations
- Describe 2-3 concrete examples of how "Enabler" tier organizations in ${industry} deploy more sophisticated AI capabilities.
- Include specific processes, tools, or metrics that differentiate them from Dabblers in the ${industry} sector.
- Focus on organizational structures, data integration practices, or automation that empowers scalable AI use.

### Leader Tier Organizations
- Describe 2-3 distinctive examples of how "Leader" tier organizations in ${industry} leverage advanced AI capabilities.
- Include specific initiatives, technologies, or strategic approaches that define excellence in ${industry}-specific AI adoption.
- Emphasize innovative practices that create significant competitive advantage in ${industry}.

IMPORTANT: After determining the user's tier, CONTEXTUALIZE these benchmarks by explicitly comparing where the organization currently stands versus the next tier they could aspire to. For example:
- If they're a "Dabbler", highlight what specifically separates them from "Enablers" in ${industry}.
- If they're an "Enabler", outline what specific steps would help them reach "Leader" status in ${industry}.
- If they're already a "Leader", emphasize what they should focus on maintaining/enhancing to stay at the cutting edge.

## Your Personalized AI Learning Path
${learningPathInstructions}

Based on your scorecard results, select 2-3 of the most relevant resources and provide a HIGHLY PERSONALIZED explanation for each.

FINAL REMINDER: DO NOT add ANY additional content after the Learning Path section. DO NOT include any promotions, advertisements, disclaimers, or external links to services like Homestyler, Wren AI, or other tools. The report MUST END with your Learning Path content.`;

    console.log('>>> BACKEND: Preparing report generation request');
    console.log('History length:', history.length);

    // Initialize AI provider manager if needed
    await aiManager.initialize();
    
    // Use the AI provider manager to generate the report
    const userPrompt = `Analyze the following assessment history for the ${industry} industry and generate the comprehensive Markdown report as instructed. IMPORTANT: Do NOT include any advertisements, promotional content, or external links in your response: ${JSON.stringify(history)}`;
    
    let reportMarkdown;
    try {
      reportMarkdown = await aiManager.generateReport(systemPrompt, userPrompt);
      console.log('>>> BACKEND: Successfully generated report using', aiManager.getCurrentProvider().name);
    } catch (error) {
      console.error('>>> BACKEND: All AI providers failed:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate report: ${errorMessage}`);
    }

    console.log('>>> BACKEND: RAW GENERATED MARKDOWN REPORT:\n', reportMarkdown);

    // Clean the report markdown to remove unwanted content
    reportMarkdown = cleanReportMarkdown(reportMarkdown);
    console.log('>>> BACKEND: CLEANED MARKDOWN REPORT:\n', reportMarkdown);

    // Extract the AI Tier from the markdown
    const tierMatch = reportMarkdown.match(/## Overall Tier:\s*(.+)/);
    const extractedTier = tierMatch ? tierMatch[1].trim() : 'N/A';
    console.log('>>> BACKEND: Extracted Tier:', extractedTier);

    // Final verification to ensure all ads are removed
    if (reportMarkdown.includes('pollinations.ai') || 
        reportMarkdown.includes('homestyler') || 
        reportMarkdown.includes('wren') || 
        reportMarkdown.includes('Learn more') ||
        reportMarkdown.includes('http') ||
        reportMarkdown.includes('Create professional')) {
      console.error('>>> BACKEND: WARNING - Ad content still detected after cleaning. Applying second-pass cleaning.');
      reportMarkdown = cleanReportMarkdown(reportMarkdown, true); // Apply aggressive second-pass cleaning
    }

    return NextResponse.json({
      reportMarkdown,
      userAITier: extractedTier, // Include the extracted tier in the response
      systemPromptUsed: systemPrompt, // Include the final system prompt
      status: 'resultsGenerated',
      providerUsed: aiManager.getCurrentProvider().name // Include which provider was used
    }, { status: 200 });
  } catch (error) {
    console.error('Error in report generation:', error);
    return NextResponse.json(
      { error: 'Failed to generate report', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Helper function to clean unwanted content from the markdown report
function cleanReportMarkdown(markdown: string, aggressive: boolean = false): string {
  // Store the original length for logging purposes
  const originalLength = markdown.length;
  let cleanedMarkdown = markdown;
  
  // Step 1: Remove known ad patterns (expanded to catch variations)
  const adPatterns = [
    // Homestyler ad pattern (original)
    /---\s*\nCreate professional 3D home designs easily with Homestyler's intuitive design platform\.\s*\[Learn more\]\(https:\/\/pollinations\.ai\/redirect\/\d+\)/g,
    
    // Broader Homestyler patterns
    /Create professional 3D home designs.*?Homestyler.*?\[Learn more\].*?\)/g,
    /Homestyler.*?intuitive design platform.*?\[Learn more\].*?\)/g,
    
    // General pollinations.ai redirect patterns
    /\[.*?\]\(https:\/\/pollinations\.ai\/redirect\/\d+\)/g,
    /https:\/\/pollinations\.ai\/redirect\/\d+/g,
    
    // Wren AI patterns
    /Wren AI.*?\[.*?\]\(http.*?\)/g,
    /\[.*?Wren.*?\]\(http.*?\)/g,
    
    // General promotion patterns
    /---\s*\n.*?\[Learn more\]\(http.*?\)/g,
    /\n\n---\s*\n.*?http.*?\n/g,
    /\n---\s*\n.*?\n/g,
    
    // Catch any remaining links to pollinations.ai
    /\(https?:\/\/.*?pollinations\.ai.*?\)/g,
    
    // Any content that appears after a horizontal rule at the end
    /\n---\s*\n(?!#).*/g,
  ];
  
  // Apply each pattern
  adPatterns.forEach(pattern => {
    cleanedMarkdown = cleanedMarkdown.replace(pattern, '');
  });
  
  // Step 2: Additional aggressive cleaning if needed or requested
  if (aggressive || originalLength !== cleanedMarkdown.length) {
    // If any cleaning was done in step 1 or aggressive mode is requested
    
    // Remove all horizontal rules and content that follows near the end
    const parts = cleanedMarkdown.split(/\n---\s*\n/);
    if (parts.length > 1) {
      // Keep only the content before the last horizontal rule
      cleanedMarkdown = parts[0];
      
      // Or keep all except the last part if it doesn't start with a markdown heading
      // This assumes ads come after the last section
      /*
      if (!parts[parts.length - 1].trimStart().startsWith('#')) {
        cleanedMarkdown = parts.slice(0, -1).join('\n');
      }
      */
    }
    
    // Remove any lines containing "Learn more" anywhere
    cleanedMarkdown = cleanedMarkdown.split('\n')
      .filter(line => !line.includes('Learn more'))
      .join('\n');
    
    // Remove any lines containing URLs to external services
    cleanedMarkdown = cleanedMarkdown.split('\n')
      .filter(line => !line.includes('http'))
      .join('\n');
  }
  
  // Step 3: Ensure the report ends with the correct content
  const lastSections = [
    '## Your Personalized AI Learning Path',
    '## Personalized AI Learning Path',
    '## Learning Path',
    '## Resources',
    '## Next Steps',
  ];
  
  let hasProperEnding = false;
  for (const section of lastSections) {
    if (cleanedMarkdown.includes(section)) {
      hasProperEnding = true;
      
      // Find the section's position
      const sectionIndex = cleanedMarkdown.indexOf(section);
      
      // Get content after the last expected section
      const contentAfterLastSection = cleanedMarkdown.substring(sectionIndex);
      
      // If there are more than 1000 characters after the last expected section,
      // it's likely we have the proper content and not an abrupt cut-off
      if (contentAfterLastSection.length < 200) {
        console.warn('>>> BACKEND: WARNING - Learning Path section may be truncated.');
      }
      
      break;
    }
  }
  
  if (!hasProperEnding) {
    console.warn('>>> BACKEND: WARNING - Report does not end with an expected Learning Path section.');
  }
  
  // Step 4: Final cleanup
  // Remove any trailing horizontal rules or dashes
  cleanedMarkdown = cleanedMarkdown.replace(/\n-{3,}\s*$/g, '');
  
  // Trim to remove any leading or trailing whitespace
  cleanedMarkdown = cleanedMarkdown.trim();
  
  // Log the cleaning results
  const charRemoved = originalLength - cleanedMarkdown.length;
  if (charRemoved > 0) {
    console.log(`>>> BACKEND: Removed ${charRemoved} characters of promotional content from report.`);
  }
  
  return cleanedMarkdown;
}

async function handleAssessmentRequest(currentPhaseName: string, history: ScorecardHistoryEntry[], industry: string) {
  try {
    // Check if we've reached MAX_QUESTIONS
    if (history.length >= MAX_QUESTIONS) {
      return NextResponse.json({
        questionText: null,
        answerType: null,
        options: null,
        phase_status: 'complete',
        overall_status: 'completed',
        currentPhaseName
      });
    }

    // If phase is complete, move to next phase
    const currentPhaseIndex = ASSESSMENT_PHASES.indexOf(currentPhaseName);
    if (currentPhaseIndex < 0) {
      // If current phase not found, start with the first phase
      return await handleAssessmentRequest(ASSESSMENT_PHASES[0], history, industry);
    }
    
    // Check if we need to move to the next phase
    const questionsInCurrentPhase = history.filter(entry => entry.phaseName === currentPhaseName).length;
    const questionsPerPhase = Math.ceil(MAX_QUESTIONS / ASSESSMENT_PHASES.length);
    
    if (questionsInCurrentPhase >= questionsPerPhase && currentPhaseIndex < ASSESSMENT_PHASES.length - 1) {
      const nextPhase = ASSESSMENT_PHASES[currentPhaseIndex + 1];
      console.log(`>>> BACKEND: Moving to next phase: ${nextPhase}`);
      return await handleAssessmentRequest(nextPhase, history, industry);
    }

    // Create the system prompt for question generation
    const systemPrompt = `Generate a new question for phase "${currentPhaseName}" in the ${industry} industry.
DO NOT repeat any previous questions. Each question must be unique.
Return JSON: {
  "questionText": string,
  "answerType": "text" | "radio" | "checkbox" | "scale",
  "options": string[] | null,
  "phase_status": "asking" | "complete",
  "overall_status": "asking" | "completed",
  "reasoning_text": string
}`;

    const userPrompt = `Based on history: ${JSON.stringify(history)}, generate next question.`;
    
    // Initialize AI provider manager if needed
    await aiManager.initialize();
    
    console.log(`>>> BACKEND: Generating next question using ${aiManager.getCurrentProvider().name}...`);
    
    let parsedResponse;
    try {
      // Use the AI provider manager to generate the next question
      parsedResponse = await aiManager.generateNextQuestion(systemPrompt, userPrompt);
      console.log(`>>> BACKEND: Successfully generated question using ${aiManager.getCurrentProvider().name}`);
    } catch (error) {
      console.error('>>> BACKEND: All AI providers failed to generate a question:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate question: ${errorMessage}`);
    }

    // Check if the AI returned a valid question
    if (!parsedResponse || !parsedResponse.questionText) {
      console.error('>>> BACKEND: AI returned invalid response or no questionText');
      console.error('>>> BACKEND: AI Response:', parsedResponse);
      throw new Error('AI returned invalid question format');
    }

    // Check for repeated questions
    if (history.some(qa => qa.question === parsedResponse.questionText)) {
      console.warn(`>>> BACKEND: AI generated a repeated question. Attempting to modify it.`);
      
      // Try to modify the question slightly to avoid repetition
      parsedResponse.questionText = `${parsedResponse.questionText} (continued)`;
      
      // If still repeating after multiple attempts, try to move to the next phase
      if (history.some(qa => qa.question === parsedResponse.questionText)) {
        if (currentPhaseIndex < ASSESSMENT_PHASES.length - 1) {
          const nextPhase = ASSESSMENT_PHASES[currentPhaseIndex + 1];
          console.log(`>>> BACKEND: Moving to next phase due to repeated questions: ${nextPhase}`);
          return await handleAssessmentRequest(nextPhase, history, industry);
        } else {
          // If no more phases, consider assessment complete
          console.warn(`>>> BACKEND: AI generated repeated questions in the last phase. Marking assessment as completed.`);
          return NextResponse.json({
            questionText: null,
            answerType: null,
            options: null,
            phase_status: 'complete',
            overall_status: 'completed',
            currentPhaseName
          });
        }
      }
    }

    return NextResponse.json({
      ...parsedResponse,
      currentPhaseName,
      providerUsed: aiManager.getCurrentProvider().name
    });

  } catch (error: any) {
    console.error('Error in handleAssessmentRequest:', error);
    return NextResponse.json(
      { error: 'Failed to generate question', message: `An error occurred while generating the next question: ${error.message}. Please try restarting the assessment.` },
      { status: 500 }
    );
  }
}

// Debug function to verify tier calculation with sample answers
function verifyTierCalculation() {
  console.log('>>> BACKEND: Running tier calculation verification tests with sample answers');
  
  // Create sample answers for each tier
  const dabblerAnswers: ScorecardHistoryEntry[] = [
    { question: "How would you describe your organization's current use of AI in marketing?", answer: "We're exploring some basic AI tools but haven't integrated them into our workflow yet.", answerType: "text" },
    { question: "Rate your team's comfort level with AI tools", answer: "2", answerType: "scale" },
    { question: "Which AI capabilities are you currently using?", answer: ["Basic content suggestions"], answerType: "checkbox" },
    { question: "How often does your team use AI tools?", answer: "Occasionally for simple tasks", answerType: "radio" },
    { question: "Do you have a strategic approach to AI adoption?", answer: "No formal strategy yet", answerType: "radio" }
  ];
  
  const enablerAnswers: ScorecardHistoryEntry[] = [
    { question: "How would you describe your organization's current use of AI in marketing?", answer: "We use several AI tools regularly and are developing more strategic applications.", answerType: "text" },
    { question: "Rate your team's comfort level with AI tools", answer: "3", answerType: "scale" },
    { question: "Which AI capabilities are you currently using?", answer: ["Content creation", "Email optimization", "Basic analytics"], answerType: "checkbox" },
    { question: "How often does your team use AI tools?", answer: "Regularly for multiple tasks", answerType: "radio" },
    { question: "Do you have a strategic approach to AI adoption?", answer: "Developing a formal strategy", answerType: "radio" }
  ];
  
  const leaderAnswers: ScorecardHistoryEntry[] = [
    { question: "How would you describe your organization's current use of AI in marketing?", answer: "We have a comprehensive, integrated AI strategy driving our marketing with advanced analytics and automation throughout our processes.", answerType: "text" },
    { question: "Rate your team's comfort level with AI tools", answer: "5", answerType: "scale" },
    { question: "Which AI capabilities are you currently using?", answer: ["Advanced predictive analytics", "AI-driven campaign orchestration", "Personalization at scale", "Automated content optimization", "Strategic planning"], answerType: "checkbox" },
    { question: "How often does your team use AI tools?", answer: "Extensively integrated across all workflows", answerType: "radio" },
    { question: "Do you have a strategic approach to AI adoption?", answer: "Comprehensive enterprise-wide AI strategy", answerType: "radio" }
  ];
  
  // Test each tier
  const dabblerScore = calculateTierScore(dabblerAnswers);
  const dabblerTier = determineTier(dabblerScore);
  console.log(`>>> BACKEND VERIFICATION: Dabbler answers scored ${dabblerScore} points → Tier: ${dabblerTier}`);
  if (dabblerTier !== 'Dabbler') {
    console.error(`>>> BACKEND VERIFICATION ERROR: Dabbler answers incorrectly classified as ${dabblerTier}`);
  }
  
  const enablerScore = calculateTierScore(enablerAnswers);
  const enablerTier = determineTier(enablerScore);
  console.log(`>>> BACKEND VERIFICATION: Enabler answers scored ${enablerScore} points → Tier: ${enablerTier}`);
  if (enablerTier !== 'Enabler') {
    console.error(`>>> BACKEND VERIFICATION ERROR: Enabler answers incorrectly classified as ${enablerTier}`);
  }
  
  const leaderScore = calculateTierScore(leaderAnswers);
  const leaderTier = determineTier(leaderScore);
  console.log(`>>> BACKEND VERIFICATION: Leader answers scored ${leaderScore} points → Tier: ${leaderTier}`);
  if (leaderTier !== 'Leader') {
    console.error(`>>> BACKEND VERIFICATION ERROR: Leader answers incorrectly classified as ${leaderTier}`);
  }
  
  console.log('>>> BACKEND: Tier verification complete');
  
  // SPECIFIC VERIFICATION FOR FINANCIAL SERVICES DABBLER CASE
  console.log('\n>>> BACKEND: SPECIFIC VERIFICATION FOR FINANCIAL SERVICES DABBLER CASE');
  
  // Representative Dabbler answers for Financial Services industry based on typical autocomplete responses
  const financialServicesDabblerAnswers: ScorecardHistoryEntry[] = [
    { 
      question: "How would you describe your organization's current approach to AI in financial services marketing?", 
      answer: "We're in the early stages of exploring basic AI tools for simple marketing tasks, but we don't have any formal implementation yet.", 
      answerType: "text",
      answerSource: "Groq Llama 3 8B"
    },
    { 
      question: "Rate your financial services team's comfort level with AI marketing tools", 
      answer: "2", 
      answerType: "scale",
      answerSource: "Groq Llama 3 8B" 
    },
    { 
      question: "Which AI capabilities is your financial services organization currently using?", 
      answer: ["Basic customer segmentation", "Simple data analysis"], 
      answerType: "checkbox",
      answerSource: "Groq Llama 3 8B" 
    },
    { 
      question: "How often does your financial services marketing team use AI tools?", 
      answer: "Occasionally for simple tasks", 
      answerType: "radio",
      answerSource: "Groq Llama 3 8B" 
    },
    { 
      question: "Do you have a strategic approach to AI adoption in financial services?", 
      answer: "No formal strategy yet", 
      answerType: "radio",
      answerSource: "Groq Llama 3 8B" 
    },
    { 
      question: "How do you collect and utilize customer data for AI in financial marketing?", 
      answer: "We have basic data collection but don't use it systematically for AI applications", 
      answerType: "text",
      answerSource: "Groq Llama 3 8B" 
    },
    { 
      question: "What percentage of your financial marketing campaigns utilize AI?", 
      answer: "Less than 10%", 
      answerType: "radio",
      answerSource: "Groq Llama 3 8B" 
    },
    { 
      question: "How do you measure the ROI of AI in your financial services marketing?", 
      answer: "We don't have a formal measurement process yet", 
      answerType: "text",
      answerSource: "Groq Llama 3 8B" 
    },
    { 
      question: "Which areas of financial marketing are you considering for future AI implementation?", 
      answer: ["Customer segmentation", "Basic personalization"], 
      answerType: "checkbox",
      answerSource: "Groq Llama 3 8B" 
    },
    { 
      question: "How would you rate your team's knowledge of AI compliance issues in financial services?", 
      answer: "1", 
      answerType: "scale",
      answerSource: "Groq Llama 3 8B" 
    },
    { 
      question: "What challenges is your organization facing with AI adoption in financial marketing?", 
      answer: "Limited understanding, resource constraints, and uncertainty about where to start", 
      answerType: "text",
      answerSource: "Groq Llama 3 8B" 
    },
    { 
      question: "How do you currently train staff on AI tools for financial marketing?", 
      answer: "No formal training program, mostly ad hoc learning", 
      answerType: "radio",
      answerSource: "Groq Llama 3 8B" 
    },
    { 
      question: "What AI-driven customer insights do you currently leverage?", 
      answer: ["Basic demographic analysis"], 
      answerType: "checkbox",
      answerSource: "Groq Llama 3 8B" 
    },
    { 
      question: "How integrated is AI with your existing financial marketing tech stack?", 
      answer: "Minimal integration, mostly standalone tools", 
      answerType: "radio",
      answerSource: "Groq Llama 3 8B" 
    },
    { 
      question: "Rate your organization's data readiness for AI in financial services", 
      answer: "2", 
      answerType: "scale",
      answerSource: "Groq Llama 3 8B" 
    },
    { 
      question: "Which customer touchpoints currently use AI in your financial services?", 
      answer: ["Basic email communication"], 
      answerType: "checkbox",
      answerSource: "Groq Llama 3 8B" 
    },
    { 
      question: "How do you approach compliance and risk when using AI in financial marketing?", 
      answer: "We're still learning about the compliance requirements", 
      answerType: "text",
      answerSource: "Groq Llama 3 8B" 
    },
    { 
      question: "What percentage of your marketing budget is allocated to AI technologies?", 
      answer: "Less than 5%", 
      answerType: "radio",
      answerSource: "Groq Llama 3 8B" 
    },
    { 
      question: "How would you describe your financial institution's AI governance structure?", 
      answer: "We don't have a formal governance structure for AI yet", 
      answerType: "text",
      answerSource: "Groq Llama 3 8B" 
    },
    { 
      question: "Which financial marketing processes have you automated with AI?", 
      answer: ["Basic email scheduling"], 
      answerType: "checkbox",
      answerSource: "Groq Llama 3 8B" 
    }
  ];
  
  console.log(`>>> Testing with ${financialServicesDabblerAnswers.length} Dabbler-level answers for Financial Services industry`);
  
  // Calculate tier with current logic
  const fsScore = calculateTierScore(financialServicesDabblerAnswers);
  const fsTier = determineTier(fsScore);
  
  console.log(`\n>>> FINANCIAL SERVICES DABBLER TEST RESULT: Score: ${fsScore}, Tier: ${fsTier}`);
  console.log(`>>> Current thresholds: Dabbler (0-${DABBLER_MAX_SCORE}), Enabler (${DABBLER_MAX_SCORE+1}-${ENABLER_MAX_SCORE}), Leader (${ENABLER_MAX_SCORE+1}+)`);
  
  if (fsTier === 'Dabbler') {
    console.log(`>>> VERIFICATION SUCCESS: Financial Services Dabbler answers correctly classified as ${fsTier}`);
  } else {
    console.error(`>>> VERIFICATION FAILURE: Financial Services Dabbler answers incorrectly classified as ${fsTier} - NEEDS RECALIBRATION`);
    
    // If we're still incorrectly classifying, adjust thresholds to fix this specific case
    if (fsTier === 'Enabler') {
      const suggestedThreshold = Math.ceil(fsScore);
      console.log(`>>> RECALIBRATION SUGGESTION: Increase DABBLER_MAX_SCORE from ${DABBLER_MAX_SCORE} to at least ${suggestedThreshold}`);
    }
  }
}
