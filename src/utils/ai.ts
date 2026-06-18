/** Google Gemini API client utilities. */

export async function callGemini(systemPrompt: string, userContent: string): Promise<string> {
  const apiKey = localStorage.getItem('gemini_api_key') || (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)
  if (!apiKey) {
    throw new Error('Please configure your Gemini API Key in Settings first.')
  }

  // Support local test mock
  if (apiKey.startsWith('AIzaSyTesting')) {
    await new Promise((resolve) => setTimeout(resolve, 800))
    if (systemPrompt.includes('task parser')) {
      return '[{"title": "Họp nhóm lúc 2h chiều", "dueDate": "2026-06-18T14:00"}]'
    }
    if (systemPrompt.includes('summarize')) {
      return `<h2>AI Summary</h2><p>Tóm tắt nội dung chính: <strong>Họp nhóm</strong> và <strong>gặp gỡ bạn bè</strong> vào buổi chiều.</p>`
    }
    if (systemPrompt.includes('formatter') || systemPrompt.includes('Visual clean')) {
      return `<h2>AI Định Dạng</h2><p>Nội dung đã được định dạng: <mark class="teal">Hôm nay</mark> đi chơi gặp bạn bè lúc <strong>2h chiều</strong>.</p>`
    }
    return `AI Định dạng:\n\nHôm nay đi chơi gặp bạn bè lúc 2h chiều.`
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${systemPrompt}\n\nInput Content:\n${userContent}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
      },
    }),
  })

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}))
    throw new Error(errData?.error?.message || `API error (${response.status})`)
  }

  const data = await response.json()
  const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!candidateText) {
    throw new Error('No content returned from Gemini API')
  }

  return candidateText.trim()
}

export async function askGeminiToFormat(htmlContent: string): Promise<string> {
  const systemPrompt = `You are an expert content formatter.
Your task is to take the provided HTML content and make it visually clean, readable and well-structured, matching a rich note editor's capabilities.
CRITICAL RULES:
1. DO NOT delete, omit, truncate or summarize any text or sections from the original content. Keep ALL information intact.
2. Correct spelling and grammar errors in-place.
3. Enhance the formatting:
   - Use <h2> or <h3> tags for headers/sections where appropriate.
   - Use <strong> tags to highlight key terms, keywords, dates, or headings.
   - Use <mark> or <mark class="red">, <mark class="amber">, <mark class="teal">, <mark class="blue">, <mark class="purple"> tags to highlight critical concepts, keywords, dates, or headings beautifully.
   - Use <ul> / <ol> for lists where appropriate.
   - Keep paragraph structures clean with proper spacing.
4. Return ONLY valid HTML code representing the formatted document. Do NOT enclose in markdown blockquotes or backticks (\`\`\`html).`
  return callGemini(systemPrompt, htmlContent)
}

export async function askGeminiToSummarize(htmlContent: string): Promise<string> {
  const systemPrompt = `Summarize the following content briefly, extract key takeaways and make it concise. Return ONLY valid HTML code representing the formatted summary. Do NOT enclose in markdown backticks \`\`\`html.`
  return callGemini(systemPrompt, htmlContent)
}

export async function askGeminiToParseTasks(prompt: string): Promise<{ title: string; dueDate: string | null }[]> {
  const systemPrompt = `You are a task parser. Extract multiple individual tasks from the input prompt.
Return ONLY a valid JSON array of objects, where each object has:
- "title": string (the task action)
- "dueDate": string or null (ISO-8601 YYYY-MM-DDTHH:mm format, or null if no date/time is mentioned. Assume today is ${new Date().toISOString()}).
Do NOT return any other text, markdown backticks or explanation. Just return the raw JSON array.`

  const rawJson = await callGemini(systemPrompt, prompt)
  const cleanJson = rawJson.replace(/^```json/, '').replace(/```$/, '').trim()
  try {
    return JSON.parse(cleanJson)
  } catch {
    throw new Error('Failed to parse AI response as JSON: ' + cleanJson)
  }
}

export async function askGeminiToFormatSpeech(speechText: string): Promise<string> {
  const systemPrompt = `You are an expert note formatter.
The user has spoken this text. Correct recognition errors, add appropriate punctuation (periods, commas, etc.), and organize into visually clean paragraphs.
RULES:
1. DO NOT delete, truncate, or change the core meaning of any spoken words. Preserve all information.
2. Bold key terms or titles using <strong> to make the note scan-friendly.
3. Use headers (<h2>, <h3>) if the speech mentions headings.
4. Return ONLY the plain corrected text/paragraphs. Do NOT wrap in markdown backticks.`
  return callGemini(systemPrompt, speechText)
}
