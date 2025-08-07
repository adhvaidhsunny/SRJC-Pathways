import React, { useState, useEffect, useRef } from "react";
import { InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { PutCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { bedrockClient, docClient } from "./aws-config";
import srjcLogo from "./assets/srjc_logo.svg";
import srjcFashion from "./assets/srjc_fashion.png";
import "./Chatbot.css";

function Landing() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const chatMessagesRef = useRef(null);
  const [messages, setMessages] = useState([
    {
      text: "Hi! I'm your SRJC Pathways assistant. How can I help you today? TYPE 'explore careers' to start our questionnaire and help me choose the pathway and career that's best for you",
      sender: "bot",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const riasecLetters = ["A", "A", "E"];
  const questions = [
    "From 1-5. Do you enjoy writing, making music, or expressing yourself through art or media?",
    "From 1-5. Do you enjoy designing logos, graphics, or visual layouts for digital or print media?",
    "From 1-5. Would you enjoy writing fiction, poetry, or screenplays in your free time?",
  ];
  
  const [conversationHistory, setConversationHistory] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isGuidedMode, setIsGuidedMode] = useState(false);

  const formatMessage = (text) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(
        /SRJC/g,
        `SRJC <img src="${srjcLogo}" alt="SRJC" class="srjc-icon" />`
      );
  };

  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { text: input, sender: "user" };
    setMessages((prev) => [...prev, userMessage]);
    const userInput = input;
    setInput("");
    setIsLoading(true);

    if (!isGuidedMode && userInput.toLowerCase().includes("explore careers")) {
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
          setIsGuidedMode(false);
        }
      } else {
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

      textBlocks.forEach((block, index) => {
        setTimeout(() => {
          setMessages((prev) => [...prev, { text: block, sender: "bot" }]);
        }, index * 1000);
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
              LOGIN
            </a>
            <a href="#" className="top-bar-link">
              LOCATIONS
            </a>
            <a href="#" className="top-bar-link">
              IT SUPPORT
            </a>
            <a href="#" className="top-bar-link">
              A-Z
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

      <div className="long-blue-bar"></div>
      <div className="landing-content">
        <img src={srjcFashion} alt="SRJC Fashion" className="fashion-image" />
      </div>
      <div className="transparent-black-bar">
        <span className="fashion-text">Fashion Studies</span>
      </div>
      <div className="chat-button" onClick={() => setIsChatOpen(!isChatOpen)}>
        💬
      </div>
      
      <div className={`chat-overlay ${isChatOpen ? 'open' : ''}`} onClick={() => setIsChatOpen(false)}></div>
      <div className={`chat-window-overlay ${isChatOpen ? 'open' : ''}`}>
        <div className="chat-window-content">
          <div className="chat-header">
            <h3>Chat with SRJC Assistant</h3>
            <button className="close-chat" onClick={() => setIsChatOpen(false)}>×</button>
          </div>
          <div className="chat-messages" ref={chatMessagesRef}>
            {messages.map((msg, index) => (
              <div key={index} className={`message ${msg.sender}`}>
                <div 
                  className="message-bubble"
                  dangerouslySetInnerHTML={{
                    __html: msg.sender === "bot" ? formatMessage(msg.text) : msg.text,
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
          </div>
          <div className="chat-input-container">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Ask about SRJC..."
              className="chat-input-small"
            />
            <button onClick={sendMessage} className="send-button-small">
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Landing;
