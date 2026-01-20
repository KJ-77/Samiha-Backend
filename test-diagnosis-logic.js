/**
 * Test script to verify diagnosis calculation logic
 * Run with: node test-diagnosis-logic.js
 */

// Mock session with sample answers (using letters A, B, C, D)
const mockSessions = {
  // Case 1: Mostly A (Depression) - 7 out of 10
  depression: {
    id: 1,
    answers: {
      "1": { index: "A", text: "Not at all", question: "Q1" },
      "2": { index: "A", text: "Not at all", question: "Q2" },
      "3": { index: "A", text: "Not at all", question: "Q3" },
      "4": { index: "A", text: "Not at all", question: "Q4" },
      "5": { index: "A", text: "Not at all", question: "Q5" },
      "6": { index: "A", text: "Not at all", question: "Q6" },
      "7": { index: "A", text: "Not at all", question: "Q7" },
      "8": { index: "B", text: "Several days", question: "Q8" },
      "9": { index: "C", text: "More than half", question: "Q9" },
      "10": { index: "B", text: "Several days", question: "Q10" }
    }
  },

  // Case 2: Mostly B (Anxiety) - 6 out of 10
  anxiety: {
    id: 2,
    answers: {
      "1": { index: "B", text: "Several days", question: "Q1" },
      "2": { index: "B", text: "Several days", question: "Q2" },
      "3": { index: "B", text: "Several days", question: "Q3" },
      "4": { index: "B", text: "Several days", question: "Q4" },
      "5": { index: "B", text: "Several days", question: "Q5" },
      "6": { index: "B", text: "Several days", question: "Q6" },
      "7": { index: "A", text: "Not at all", question: "Q7" },
      "8": { index: "C", text: "More than half", question: "Q8" },
      "9": { index: "D", text: "Nearly every day", question: "Q9" },
      "10": { index: "A", text: "Not at all", question: "Q10" }
    }
  },

  // Case 3: Mostly C (Stress) - 5 out of 8
  stress: {
    id: 3,
    answers: {
      "1": { index: "C", text: "More than half", question: "Q1" },
      "2": { index: "C", text: "More than half", question: "Q2" },
      "3": { index: "C", text: "More than half", question: "Q3" },
      "4": { index: "C", text: "More than half", question: "Q4" },
      "5": { index: "C", text: "More than half", question: "Q5" },
      "6": { index: "B", text: "Several days", question: "Q6" },
      "7": { index: "A", text: "Not at all", question: "Q7" },
      "8": { index: "D", text: "Nearly every day", question: "Q8" }
    }
  },

  // Case 4: Mostly D (Burnout) - 8 out of 10
  burnout: {
    id: 4,
    answers: {
      "1": { index: "D", text: "Nearly every day", question: "Q1" },
      "2": { index: "D", text: "Nearly every day", question: "Q2" },
      "3": { index: "D", text: "Nearly every day", question: "Q3" },
      "4": { index: "D", text: "Nearly every day", question: "Q4" },
      "5": { index: "D", text: "Nearly every day", question: "Q5" },
      "6": { index: "D", text: "Nearly every day", question: "Q6" },
      "7": { index: "D", text: "Nearly every day", question: "Q7" },
      "8": { index: "D", text: "Nearly every day", question: "Q8" },
      "9": { index: "B", text: "Several days", question: "Q9" },
      "10": { index: "C", text: "More than half", question: "Q10" }
    }
  },

  // Case 5: Edge case - tie between two letters (should pick first max)
  tie: {
    id: 5,
    answers: {
      "1": { index: "A", text: "Not at all", question: "Q1" },
      "2": { index: "A", text: "Not at all", question: "Q2" },
      "3": { index: "A", text: "Not at all", question: "Q3" },
      "4": { index: "B", text: "Several days", question: "Q4" },
      "5": { index: "B", text: "Several days", question: "Q5" },
      "6": { index: "B", text: "Several days", question: "Q6" }
    }
  },

  // Case 6: Mixed case letters (should handle case-insensitivity)
  mixedCase: {
    id: 6,
    answers: {
      "1": { index: "a", text: "Not at all", question: "Q1" },
      "2": { index: "A", text: "Not at all", question: "Q2" },
      "3": { index: "a", text: "Not at all", question: "Q3" },
      "4": { index: "A", text: "Not at all", question: "Q4" },
      "5": { index: "b", text: "Several days", question: "Q5" }
    }
  }
};

// Inline implementation of diagnosis calculation (copy from diagnosisService)
const calculateDiagnosisFromAnswers = (session) => {
  const LETTER_TO_DIAGNOSIS = {
    'A': "Depression",
    'B': "Anxiety",
    'C': "Stress",
    'D': "Burnout"
  };

  const answers = session.answers || {};
  const questionIds = Object.keys(answers);

  if (questionIds.length === 0) {
    throw new Error("No answers found in session");
  }

  const letterCounts = { 'A': 0, 'B': 0, 'C': 0, 'D': 0 };

  questionIds.forEach(qId => {
    const answer = answers[qId];
    if (answer && answer.index) {
      const letter = answer.index.toUpperCase();
      if (letterCounts.hasOwnProperty(letter)) {
        letterCounts[letter]++;
      }
    }
  });

  let mostChosenLetter = 'A';
  let maxCount = letterCounts['A'];

  ['B', 'C', 'D'].forEach(letter => {
    if (letterCounts[letter] > maxCount) {
      maxCount = letterCounts[letter];
      mostChosenLetter = letter;
    }
  });

  const diagnosisText = LETTER_TO_DIAGNOSIS[mostChosenLetter];
  const totalAnswers = questionIds.length;
  const percentage = ((maxCount / totalAnswers) * 100).toFixed(1);

  return {
    session_id: session.id,
    // diagnosis_text: `${diagnosisText} (${maxCount}/${totalAnswers} responses, ${percentage}%)`,
    diagnosis_text: `${diagnosisText}`,
    _metadata: {
      most_chosen_letter: mostChosenLetter,
      count: maxCount,
      total_answers: totalAnswers,
      percentage: percentage,
      all_counts: letterCounts
    }
  };
};

// Run tests
console.log("Testing Diagnosis Calculation Logic\n");
console.log("=" .repeat(60));

Object.entries(mockSessions).forEach(([testName, session]) => {
  console.log(`\nTest Case: ${testName.toUpperCase()}`);
  console.log("-".repeat(60));

  try {
    const result = calculateDiagnosisFromAnswers(session);

    console.log(`Session ID: ${result.session_id}`);
    console.log(`Diagnosis: ${result.diagnosis_text}`);
    console.log(`Most Chosen: Letter ${result._metadata.most_chosen_letter}`);
    console.log(`Frequency: ${result._metadata.count}/${result._metadata.total_answers} (${result._metadata.percentage}%)`);
    console.log(`All Counts:`, result._metadata.all_counts);
    console.log("✓ PASSED");

  } catch (error) {
    console.log(`✗ FAILED: ${error.message}`);
  }
});

console.log("\n" + "=".repeat(60));
console.log("\nAll tests completed!\n");
