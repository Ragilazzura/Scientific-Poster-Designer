
import { GoogleGenAI, Type, Chat } from "@google/genai";
import type { PosterData, PosterSection } from '../types';

const posterSchema = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING, description: "The main title of the research poster." },
        authors: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of author names." },
        university: { type: Type.STRING, description: "The name of the university or institution." },
        department: { type: Type.STRING, description: "The specific department within the university." },
        rightLogoUrl: { type: Type.STRING, description: "URL for the main institution logo (top right). Leave empty string if not clearly available." },
        leftLogoUrl: { type: Type.STRING, description: "URL for a secondary logo (top left). Leave empty string if not clearly available." },
        theme: {
            type: Type.OBJECT,
            properties: {
                backgroundColor: { type: Type.STRING, description: "A light hex code for the poster's outer background, e.g., #F0F4F8." },
                headerColor: { type: Type.STRING, description: "A professional, medium-to-dark hex code for the header and footer background, e.g., #2C3E50." },
                titleColor: { type: Type.STRING, description: "A light color hex code for the main title, to contrast with the header color, e.g., #FFFFFF." },
                headingColor: { type: Type.STRING, description: "A strong but not overpowering hex code for section headings, e.g., #1A5276." },
                textColor: { type: Type.STRING, description: "A readable, dark gray hex code for the main poster text (used for elements outside of sections), e.g., #34495E." },
                accentColor: { type: Type.STRING, description: "A complementary hex code for borders or highlights, e.g., #3498DB." },
                sectionBackgroundColor: { type: Type.STRING, description: "A very light hex code for content section backgrounds, e.g., #FFFFFF or #F8F9FA." },
                sectionBodyColor: { type: Type.STRING, description: "A readable dark hex code for text inside sections, e.g., #34495E." },
            },
            required: ['backgroundColor', 'headerColor', 'titleColor', 'headingColor', 'textColor', 'accentColor', 'sectionBackgroundColor', 'sectionBodyColor'],
        },
        sections: {
            type: Type.ARRAY,
            description: "An array of poster sections. IMPORTANT: If the source text divides 'Findings' or 'Results' into specific subsections (e.g., 'Result A', 'Result B'), generate SEPARATE sections for each in the array. Do not combine them if they are distinct in the source text.",
            items: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING, description: "The title of the section (e.g., 'Introduction', 'Results: Phase 1', 'Results: Phase 2')." },
                    content: { type: Type.STRING, description: "Concise paragraph content. Summarize heavily. Scientific posters should not be walls of text." },
                    column: { type: Type.STRING, description: "The column number ('1' or '2').", enum: ['1', '2'] },
                    design: {
                        type: Type.OBJECT,
                        properties: {
                            icon: { type: Type.STRING, enum: ['academic', 'chart', 'beaker', 'bulb', 'target', 'clipboard', 'book', 'pie', 'table'] },
                            variant: { type: Type.STRING, enum: ['default', 'minimal', 'solid'] },
                            customColor: { type: Type.STRING }
                        }
                    },
                    visuals: {
                        type: Type.ARRAY,
                        description: "Include visual elements (charts/tables/images) ONLY if the section is 'Results', 'Findings', or 'Data Analysis'.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                type: { type: Type.STRING, description: "The type of visual.", enum: ['donutChart', 'lineChart', 'barChart', 'image', 'table'] },
                                items: { type: Type.ARRAY, description: "For donut charts. Limit to 5-6 key items.", items: { type: Type.OBJECT, properties: { label: { type: Type.STRING }, value: { type: Type.NUMBER }, color: { type: Type.STRING } } } },
                                labels: { type: Type.ARRAY, description: "For line/bar charts (X-axis). Limit to max 8 labels to keep JSON valid.", items: { type: Type.STRING } },
                                datasets: { type: Type.ARRAY, description: "For line/bar charts. Limit to max 2 datasets with max 8 data points each.", items: { type: Type.OBJECT, properties: { label: { type: Type.STRING }, data: { type: Type.ARRAY, items: { type: Type.NUMBER } }, color: { type: Type.STRING } } } },
                                url: { type: Type.STRING, description: "For images. Use `https://image.pollinations.ai/prompt/<encoded_keywords>?width=1024&height=1024&nologo=true`." },
                                caption: { type: Type.STRING },
                                style: { type: Type.STRING, enum: ['normal', 'circular'] },
                                headers: { type: Type.ARRAY, description: "For tables. Max 4 columns.", items: { type: Type.STRING } },
                                rows: { type: Type.ARRAY, description: "For tables. Max 5 rows.", items: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.STRING } } } }
                            }
                        }
                    }
                },
                required: ['title', 'content', 'column']
            }
        },
        contactInfo: {
            type: Type.OBJECT,
            description: "Contact information for the footer.",
            properties: {
                email: { type: Type.STRING },
                phone: { type: Type.STRING },
                location: { type: Type.STRING },
                website: { type: Type.STRING },
                qrCodeUrl: { type: Type.STRING, description: "URL for a QR code." }
            },
            required: ['email', 'phone', 'location', 'website', 'qrCodeUrl']
        }
    },
    required: ['title', 'authors', 'university', 'department', 'rightLogoUrl', 'theme', 'sections', 'contactInfo']
};

const systemInstruction = `You are a World-Class Scientific Poster Designer.
Your goal is to take raw research text and transform it into a visually stunning, structurally sound Vertical (Portrait) 2-column poster.

**CORE RESPONSIBILITIES:**

1.  **MANDATORY STRUCTURE (2 Columns for Vertical Layout):**
    *   **Column 1 (Left):** 'Abstract', 'Introduction', 'Objectives', 'Methodology'.
    *   **Column 2 (Right):** 'Results', 'Findings', 'Analysis', 'Discussion', 'Conclusion', 'Future Work'.

2.  **HANDLING RESULTS & FINDINGS (CRITICAL):**
    *   **Respect Source Granularity:** Check the input text carefully.
    *   **Scenario A (Split Findings):** If the research text breaks findings into specific sub-topics (e.g., "Experiment 1 Results", "Survey Demographics", "Performance Benchmarks"), you MUST create **separate sections/cards** for each of these in Column 2. Do NOT merge them into one generic "Results" section.
    *   **Scenario B (Unified Findings):** If the research text has a single, continuous findings section, create one single "Results" section in Column 2.
    *   **Visuals:** Each specific result section in Column 2 should have its own relevant charts or tables in the \`visuals\` array.

3.  **Visual Placement Rules:**
    *   **ONLY** generate charts/visuals for sections in Column 2 (Results/Findings).
    *   **DO NOT** generate visuals for 'Introduction', 'Methodology', 'Discussion', or 'Conclusion'.
    *   **Constraint:** Keep datasets small (max 8 points) to ensure the JSON response is valid.

4.  **Content Quality:**
    *   **Summarize Heavily:** Create punchy, readable paragraphs.
    *   **Completeness:** Do NOT truncate lists, but summarize descriptions.
    *   **Escaping:** Use single quotes for emphasis within text to avoid breaking JSON (e.g., 'Tour-Vlog'). **NEVER use double quotes inside a JSON string without escaping them.** Incorrect: "The "Project"". Correct: "The \\"Project\\"".

5.  **Design Logic:**
    *   **Theme:** Pick colors that match the scientific field.
    *   **Logos:** Default to empty string unless provided.

**CRITICAL JSON FORMATTING:**
*   You must return **strictly valid JSON**.
*   **Verify Commas:** Ensure every object in an array (sections, visuals, datasets) is separated by a comma.
*   **Verify Strings:** Ensure every string in a list (authors, labels) is separated by a comma.
*   Do not leave trailing commas at the end of lists.
*   Do not output markdown text outside the JSON block.`;

// Helper to sanitize and deduplicate sections
const sanitizeData = (data: PosterData): PosterData => {
    if (!data || !data.sections || !Array.isArray(data.sections)) {
        return data;
    }

    const seen = new Set<string>();
    const uniqueSections: PosterSection[] = [];

    data.sections.forEach(section => {
        // 1. Sanitize Column
        let col = String(section.column).replace(/column\s*/i, '').trim();
        
        // Intelligent column assignment based on title keywords if column is weird
        if (!['1', '2'].includes(col)) {
            const titleLower = section.title?.toLowerCase() || '';
            if (titleLower.includes('abstract') || titleLower.includes('intro') || titleLower.includes('method') || titleLower.includes('objective')) {
                col = '1';
            } else {
                col = '2'; 
            }
        }
        section.column = col as '1' | '2' | '3'; // Keep types compatible, but logic enforces 1 or 2

        // 2. Normalize Visuals to Array (Legacy compatibility)
        if (section.visual) {
            if (!section.visuals) {
                section.visuals = [];
            }
            section.visuals.push(section.visual);
            delete section.visual;
        }
        // Ensure visuals array exists
        if (!section.visuals) {
            section.visuals = [];
        }

        // 3. Create fingerprint (Title + Content) to detect duplicates
        const fingerprint = `${section.title?.trim().toLowerCase()}|${section.content?.trim().toLowerCase()}`;

        if (!seen.has(fingerprint)) {
            seen.add(fingerprint);
            uniqueSections.push(section);
        }
    });

    data.sections = uniqueSections;
    return data;
};

const parseJsonResponse = (text: string): PosterData | { error: string } => {
    // 1. Clean markdown code blocks
    let cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();

    // 2. Balanced Brace Extractor (String Aware & Auto-Repair)
    const extractBalancedJSON = (str: string) => {
        const start = str.indexOf('{');
        if (start === -1) return str;

        let openBraces = 0; // {
        let openBrackets = 0; // [
        let inString = false;
        let escape = false;

        for (let i = start; i < str.length; i++) {
            const char = str[i];
            
            if (inString) {
                if (escape) {
                    escape = false;
                } else if (char === '\\') {
                    escape = true;
                } else if (char === '"') {
                    inString = false;
                }
            } else {
                if (char === '"') {
                    inString = true;
                } else if (char === '{') {
                    openBraces++;
                } else if (char === '}') {
                    openBraces--;
                } else if (char === '[') {
                    openBrackets++;
                } else if (char === ']') {
                    openBrackets--;
                }

                if (openBraces === 0 && openBrackets === 0 && i > start) {
                    // Found complete object
                    return str.substring(start, i + 1);
                }
            }
        }
        
        // Auto-repair truncated JSON
        let repaired = str.substring(start);
        if (inString) repaired += '"';
        while (openBrackets > 0) { repaired += ']'; openBrackets--; }
        while (openBraces > 0) { repaired += '}'; openBraces--; }
        
        return repaired;
    };

    cleanText = extractBalancedJSON(cleanText);

    try {
        const rawData = JSON.parse(cleanText) as PosterData;
        return sanitizeData(rawData);

    } catch (e: any) {
        console.warn("JSON parsing error (Attempt 1):", e instanceof Error ? e.message : e);
        
        // Fallback: Try to fix common AI JSON errors
        try {
             let fixedText = cleanText;

             // 0. Remove JS comments if any
             fixedText = fixedText.replace(/\/\/.*$/gm, '');

             // NEW: Fix missing commas before specific known keys (Context-Aware Repair)
             const knownKeys = [
                'title', 'authors', 'university', 'department', 'rightLogoUrl', 'leftLogoUrl', 'theme', 'sections', 'contactInfo',
                'backgroundColor', 'headerColor', 'titleColor', 'headingColor', 'textColor', 'accentColor', 'sectionBackgroundColor', 'sectionBodyColor',
                'content', 'column', 'visuals',
                'type', 'items', 'labels', 'datasets', 'url', 'caption', 'style', 'headers', 'rows',
                'value', 'color', 'data',
                'email', 'phone', 'location', 'website', 'qrCodeUrl',
                // Updated keys
                'design', 'icon', 'variant', 'customColor'
             ];
             // Matches: "value" "key": -> "value", "key":
             const keyRegex = new RegExp(`"\\s+"(${knownKeys.join('|')})":`, 'g');
             fixedText = fixedText.replace(keyRegex, '", "$1":');
             
             // Matches: } "key": -> }, "key":
             const braceKeyRegex = new RegExp(`}\\s+"(${knownKeys.join('|')})":`, 'g');
             fixedText = fixedText.replace(braceKeyRegex, '}, "$1":');

             // Matches: ] "key": -> ], "key":
             const bracketKeyRegex = new RegExp(`]\\s+"(${knownKeys.join('|')})":`, 'g');
             fixedText = fixedText.replace(bracketKeyRegex, '], "$1":');

             // 1. Fix missing commas between objects in arrays: } {  ->  }, {
             fixedText = fixedText.replace(/}(\s*){/g, '}, $1{');

             // 2. Fix missing commas between arrays: ] [ -> ], [
             fixedText = fixedText.replace(/](\s*)\[/g, '], $1[');

             // 3. Fix missing commas between strings in arrays: "str" "str" -> "str", "str"
             fixedText = fixedText.replace(/"(\s+)"/g, '", $1"');

             // 4. Fix missing commas between string and non-string value: "str" 123 -> "str", 123
             fixedText = fixedText.replace(/"(\s+)([\dtfn\[{])/g, '", $1$2');

             // 5. Fix missing commas after values (numbers/bools/null) before next key string
             fixedText = fixedText.replace(/(\d+|true|false|null)(\s+)"/g, '$1, $2"');

             // 6. Fix missing commas between numbers in arrays: 1 2 3 -> 1, 2, 3
             fixedText = fixedText.replace(/(\d)\s+(\d)/g, '$1, $2');

             // 7. Fix missing commas after closing bracket/brace and next property name/string (General Fallback)
             fixedText = fixedText.replace(/([\]}])(\s*)"/g, '$1, $2"');

             // 8. Fix trailing commas before closing braces/brackets: , } -> }
             fixedText = fixedText.replace(/,\s*([\]}])/g, '$1');

             // 9. Fix unescaped quotes: Quote preceded by non-syntax, followed by non-syntax
             // Matches word"word or word "word where the " is clearly not a JSON delimiter
             // Excludes: "key": (colon follows), "value", (comma follows), "value"} (brace follows)
             // \w is [a-zA-Z0-9_]
             fixedText = fixedText.replace(/([^\[\{\:,\s\\])\s*"\s*([^:,\}\]\s])/g, '$1\\"$2');

             // 10. Aggressive unescaped quote fix: Quote surrounded by text
             // e.g. " The "Tour -> " The \"Tour
             fixedText = fixedText.replace(/([a-zA-Z0-9.,;!?])\s+"([a-zA-Z0-9])/g, '$1 \\"$2');

             // e.g. Vlog" project -> Vlog\" project
             fixedText = fixedText.replace(/([a-zA-Z0-9])"\s+([a-zA-Z0-9.,;!?])/g, '$1\\" $2');
             
             const rawData = JSON.parse(fixedText) as PosterData;
             return sanitizeData(rawData);
        } catch (e2) {
             const errorDetails = e instanceof Error ? e.message : String(e);
             console.error("JSON fixing failed:", errorDetails);
             return { error: `We encountered a formatting issue with the AI's response. Please try generating again, or use a shorter input text to reduce complexity.` };
        }
    }
};

export const startPosterChat = async (
    designPrompt: string,
    fileContent: string,
    setLoadingMessage: (message: string) => void
): Promise<{ posterData?: PosterData; chat?: Chat; error?: string }> => {
    setLoadingMessage("Analyzing research data for visual opportunities...");
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const chat = ai.chats.create({
        model: 'gemini-2.5-flash', 
        config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: posterSchema,
            maxOutputTokens: 8192, // Increased to prevent truncation
        },
    });

    // Truncate file content to safe limit
    const truncatedContent = fileContent.slice(0, 45000); 

    const initialPrompt = `Design Prompt: "${designPrompt}"\n\nResearch Content (Excerpt):\n---\n${truncatedContent}`;

    try {
        setLoadingMessage("Structuring layout and generating scientific charts...");
        const result = await chat.sendMessage({ message: initialPrompt });
        const posterData = parseJsonResponse(result.text);
        
        if ('error' in posterData) {
            return { error: posterData.error };
        }
        
        return { posterData, chat };

    } catch (e: any) {
        console.error("Error generating poster:", e);
        return { error: e.message || "An unknown error occurred during poster generation." };
    }
};

export const revisePosterData = async (
    chat: Chat,
    revisionPrompt: string
): Promise<PosterData | { error: string }> => {
    try {
        const result = await chat.sendMessage({ message: revisionPrompt });
        const posterData = parseJsonResponse(result.text);

        if ('error' in posterData) {
            return { error: posterData.error };
        }
        
        return posterData;
    } catch (e: any) {
        console.error("Error revising poster:", e);
        return { error: e.message || "An unknown error occurred during revision." };
    }
};
