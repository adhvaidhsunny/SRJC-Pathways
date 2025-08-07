import React, { useState, useEffect, useRef } from "react";
import { InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { PutCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { bedrockClient, docClient } from "./aws-config";
import srjcLogo from "./assets/srjc_logo.svg";
import "./Chatbot.css";

function Chatbot() {
  const chatWindowRef = useRef(null);
  // Load initial state from localStorage or use defaults
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem("chatbot-messages");
    return saved
      ? JSON.parse(saved)
      : [
          {
            text: "Hi! I'm your SRJC Pathways assistant. How can I help you today? TYPE 'explore careers' to start our questionnaire and help me choose the pathway and career that's best for you",
            sender: "bot",
          },
        ];
  });
  const [input, setInput] = useState("");

  const riasecLetters = ["A", "A", "E"]; //'R', 'R', 'I', 'C', 'I', 'S', 'E', 'C', 'I', 'R', 'C', 'R', 'S', 'C', 'E', 'E', 'S',

  //change this to pull from s3
  const questions = [
    "From 1-5. Do you enjoy writing, making music, or expressing yourself through art or media?",
    "From 1-5. Do you enjoy designing logos, graphics, or visual layouts for digital or print media?",
    "From 1-5. Would you enjoy writing fiction, poetry, or screenplays in your free time?",
  ];

  // "From 1-5. Do you like convincing others of your point of view or debating ideas?",
  // "From 1-5. Do you enjoy solving puzzles, riddles, or complex problems just for fun?",
  // "From 1-5. Do you enjoy performing in front of others—like music, dance, or theater?",
  // "From 1-5. Would you like to run or grow your own business one day?",
  //   "From 1-5. Are you interested in marketing, selling, or promoting new ideas or products?",
  //   "From 1-5. Are you interested in law, public safety, or advocating for others in legal situations?",
  //   "From 1-5. Do you enjoy teaching, coaching, or guiding others to learn something new?",
  //   "From 1-5. Do you like hands-on projects like building furniture, laying tile, or designing physical spaces?",
  //   "From 1-5. Do you enjoy building, repairing, or operating tools and equipment?",
  //   "From 1-5. Are you curious about programming, using computers, or working with technology?",
  //   "From 1-5. Do you prefer clerical tasks like sorting mail, keeping records, or proofreading documents?",
  //   "From 1-5. Are you interested in doing science experiments or figuring out how things in nature work?",
  //   "From 1-5. Do you like helping people solve emotional or personal problems?",
  //   "From 1-5. Do you like managing a business, leading teams, or making important decisions?",
  //   "From 1-5. Do you enjoy working with numbers, keeping records, or handling financial tasks?",
  //   "From 1-5. Would you enjoy working in a laboratory setting doing medical or scientific testing?",
  //   "From 1-5. Would you enjoy working outdoors, driving, or doing physical tasks like firefighting?",
  //   "From 1-5. Do you like organizing inventory or working in retail or warehouse environments?",
  //   "From 1-5. Are you interested in taking care of animals or protecting the environment?",
  //   "From 1-5. Do you enjoy giving advice, mentoring others, or offering guidance on life or careers?",
  //   "From 1-5. Do you like checking the quality of things or making sure products meet standards?"

  const [conversationHistory, setConversationHistory] = useState(() => {
    const saved = localStorage.getItem("chatbot-conversation-history");
    return saved ? JSON.parse(saved) : [];
  });
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(() => {
    const saved = localStorage.getItem("chatbot-question-index");
    return saved ? parseInt(saved) : 0;
  });
  const [isGuidedMode, setIsGuidedMode] = useState(() => {
    const saved = localStorage.getItem("chatbot-guided-mode");
    return saved ? JSON.parse(saved) : false;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [typingMessage, setTypingMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  // Convert markdown formatting to HTML
  const formatMessage = (text) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(
        /SRJC/g,
        `SRJC <img src="${srjcLogo}" alt="SRJC" class="srjc-icon" />`
      );
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [messages]);

  // Save to localStorage whenever state changes
  useEffect(() => {
    localStorage.setItem("chatbot-messages", JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem(
      "chatbot-conversation-history",
      JSON.stringify(conversationHistory)
    );
  }, [conversationHistory]);

  useEffect(() => {
    localStorage.setItem(
      "chatbot-question-index",
      currentQuestionIndex.toString()
    );
  }, [currentQuestionIndex]);

  useEffect(() => {
    localStorage.setItem("chatbot-guided-mode", JSON.stringify(isGuidedMode));
  }, [isGuidedMode]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { text: input, sender: "user" };
    setMessages((prev) => [...prev, userMessage]);
    const userInput = input;
    setInput("");
    setIsLoading(true);

    if (!isGuidedMode && userInput.toLowerCase().includes("explore careers")) {
      // Trigger guided flow
      setIsGuidedMode(true);
      const firstQuestion = questions[0];
      setCurrentQuestionIndex(0);
      setMessages((prev) => [...prev, { text: firstQuestion, sender: "bot" }]);
      setIsLoading(false);
      return;
    }

    try {
      let prompt;

      if (isGuidedMode) {
        // In guided mode: collect history + build prompt with context
        const updatedHistory = [
          ...conversationHistory,
          {
            question: questions[currentQuestionIndex],
            answer: userInput,
          },
        ];
        setConversationHistory(updatedHistory);

        const nextIndex = currentQuestionIndex + 1;
        const nextQuestion = questions[nextIndex];

        setCurrentQuestionIndex(nextIndex);

        // Update DynamoDB after each question
        const score = parseInt(userInput) || 0;
        const letter = riasecLetters[currentQuestionIndex];
        const userId = localStorage.getItem("userId") || Date.now().toString();
        localStorage.setItem("userId", userId);

        try {
          await docClient.send(
            new UpdateCommand({
              TableName: "SRJCPathwaysResponses",
              Key: { id: userId },
              UpdateExpression:
                "ADD riasecScores.#letter :score SET #ts = :timestamp",
              ExpressionAttributeNames: {
                "#letter": letter,
                "#ts": "timestamp",
              },
              ExpressionAttributeValues: {
                ":score": score,
                ":timestamp": new Date().toISOString(),
              },
            })
          );
        } catch (dbError) {
          if (dbError.name === "ValidationException") {
            // First question - create new record
            await docClient.send(
              new PutCommand({
                TableName: "SRJCPathwaysResponses",
                Item: {
                  id: userId,
                  timestamp: new Date().toISOString(),
                  riasecScores: { [letter]: score },
                  score: "",
                },
              })
            );
          }
        }

        prompt = `You're texting with a student 📱 Split your response into 1-3 separate text blocks. Each block should be 1-2 sentences max. Use |SPLIT| between blocks. Use emojis and be casual. **BOLD** important words and *italicize* for emphasis! Think multiple text bubbles like real texting! 😊\n\nHere is the conversation so far:\n`;

        updatedHistory.forEach((item, i) => {
          prompt += `Q${i + 1}: ${item.question}\nUser: ${item.answer}\n`;
        });

        if (nextQuestion) {
          prompt += `Now respond to the user's last answer, then ask: "${nextQuestion}"`;
        } else {
          prompt += `Split your response into 1-3 separate text blocks. Each block 1-2 sentences. Respond to their answer then suggest SRJC programs. Use |SPLIT| between blocks. **BOLD** important words and *italicize* for emphasis!`;

          // Get final scores and calculate top 3 RIASEC code
          try {
            const result = await docClient.send(
              new GetCommand({
                TableName: "SRJCPathwaysResponses",
                Key: { id: userId },
              })
            );

            console.log("Retrieved data:", result.Item);
            const scores = result.Item?.riasecScores || {};
            console.log("Scores:", scores);

            const sortedScores = Object.entries(scores)
              .map(([letter, value]) => [
                letter,
                typeof value === "object" ? parseInt(value.N) : value,
              ])
              .sort(([, a], [, b]) => b - a)
              .slice(0, 3)
              .map(([letter]) => letter)
              .join("");

            console.log("Final RIASEC Code:", sortedScores);

            // Store the complete record with score
            await docClient.send(
              new PutCommand({
                TableName: "SRJCPathwaysResponses",
                Item: {
                  ...result.Item,
                  score: sortedScores,
                  timestamp: new Date().toISOString(),
                },
              })
            );

            // alert('Score stored: ' + sortedScores);
          } catch (dbError) {
            console.error("Final score calculation error:", dbError);
          }

          setIsGuidedMode(false); // End guided mode
        }
      } else {
        // Default (non-guided) use
        prompt = `You're texting with a student about SRJC! 📚 Split your response into 1-3 separate text blocks using |SPLIT| between them. Each block max 2 sentences. Use emojis and **BOLD** important words and *italicize* for emphasis!\n\nStudent question: ${userInput}\n\nResponse:`;
      }

      const command = new InvokeModelCommand({
        modelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: 100,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      });

      const response = await bedrockClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const botText = responseBody.content[0].text;
      const textBlocks = botText
        .split("|SPLIT|")
        .map((block) => block.trim())
        .filter((block) => block);

      setIsLoading(false);

      // Add each text block as separate message with delay
      textBlocks.forEach((block, index) => {
        setTimeout(() => {
          setMessages((prev) => [...prev, { text: block, sender: "bot" }]);
        }, index * 1000); // 1 second delay between messages
      });
    } catch (error) {
      console.error("Bedrock error:", error);
      const errorResponse = {
        text: `Connection error: ${
          error.message || "Unknown error"
        }. Check console for details.`,
        sender: "bot",
      };
      setMessages((prev) => [...prev, errorResponse]);
      setIsLoading(false);
    }
  };

  return (
    <div className="chatbot-container">
      <div className="top-grey-bar">
        <div className="grey-bar-nav">
          <a href="#" className="grey-nav-link">
            Students
          </a>
          <a href="#" className="grey-nav-link">
            Faculty/Staff
          </a>
          <a href="#" className="grey-nav-link">
            Community
          </a>
        </div>
        <div className="top-bar-buttons">
          <div className="top-bar-links">
            <a href="#" className="top-bar-link">
              A-Z
            </a>
            <a href="#" className="top-bar-link">
              IT SUPPORT
            </a>
            <a href="#" className="top-bar-link">
              LOCATIONS
            </a>
            <a href="#" className="top-bar-link">
              LOGIN
            </a>
          </div>
          <div className="action-buttons">
            <div className="yellow-block">
              <a href="#" className="yellow-link">
                QUICK LINKS
              </a>
            </div>
            <div className="apply-now-block">
              <a href="#" className="apply-now-link">
                APPLY NOW
              </a>
            </div>
          </div>
        </div>
      </div>
      <header className="chatbot-header">
        <div className="header-content">
          <img src={srjcLogo} alt="SRJC" className="header-logo" />
          <div className="title-stack">
            <h1>Pathways</h1>
            <div className="assistant-line">
              <h2>Assistant</h2>
              <span className="motto">Learn your way</span>
            </div>
          </div>
        </div>
      </header>
      <div className="blue-bar"></div>

      <div className="chat-window" ref={chatWindowRef}>
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.sender}`}>
            <div
              className="message-bubble"
              dangerouslySetInnerHTML={{
                __html:
                  msg.sender === "bot" ? formatMessage(msg.text) : msg.text,
              }}
            />
          </div>
        ))}
        {isLoading && (
          <div className="message bot">
            <div className="message-bubble typing">
              <div className="typing-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        {isTyping && (
          <div className="message bot">
            <div
              className="message-bubble"
              dangerouslySetInnerHTML={{
                __html:
                  formatMessage(typingMessage) +
                  '<span class="cursor">|</span>',
              }}
            />
          </div>
        )}
      </div>

      {!isGuidedMode && (
        <div className="quick-actions">
          <button
            onClick={() => {
              setIsGuidedMode(true);
              const firstQuestion = questions[0];
              setCurrentQuestionIndex(0);
              setMessages((prev) => [
                ...prev,
                { text: firstQuestion, sender: "bot" },
              ]);
            }}
            className="explore-button"
          >
            🎓 Explore Careers
          </button>
        </div>
      )}

      <div className="input-container">
        <div className="input-wrapper">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Ask about SRJC programs..."
            className="chat-input"
          />
          <button onClick={sendMessage} className="send-button">
            Send
          </button>
          <button
            onClick={() => {
              localStorage.removeItem("chatbot-messages");
              localStorage.removeItem("chatbot-conversation-history");
              localStorage.removeItem("chatbot-question-index");
              localStorage.removeItem("chatbot-guided-mode");
              setMessages([
                {
                  text: "Hi! I'm your SRJC Pathways assistant. How can I help you today? TYPE 'explore careers' to start our questionnaire and help me choose the pathway and career that's best for you",
                  sender: "bot",
                },
              ]);
              setConversationHistory([]);
              setCurrentQuestionIndex(0);
              setIsGuidedMode(false);
            }}
            className="clear-button"
          >
            Start Over
          </button>
        </div>
      </div>
    </div>
  );
}

export default Chatbot;
