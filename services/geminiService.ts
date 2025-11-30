import { GoogleGenAI, Type, Chat } from "@google/genai";
import type { PosterData, PosterSection } from '../types';

const posterSchema = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING, description: "EXTRACT THE EXACT TITLE from the uploaded document. Do NOT rewrite, summarize, or make it 'punchy'. Use the verbatim title found in the source text. Only shorten if it exceeds 30 words." },
        authors: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of author names." },
        university: { type: Type.STRING, description: "The name of the university or institution." },
        department: { type: Type.STRING, description: "The specific department within the university." },
        rightLogoUrl: { type: Type.STRING, description: "URL for the main institution logo (top right). Leave empty string if not clearly available." },
        leftLogoUrl: { type: Type.STRING, description: "URL for a secondary logo (top left). Leave empty string if not clearly available." },
        warnings: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING }, 
            description: "Only add warnings if you are 100% CERTAIN the content is completely absent after deep analysis. Do not warn if you successfully inferred the section from other parts." 
        },
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
            description: "An array of poster sections. You MUST cover the standard scientific flow: Abstract, Intro, Methods, Results (Split by key finding), Discussion, Conclusion, Recommendations, References.",
            items: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING, description: "The title of the section (e.g., 'Introduction', 'Results: Student Engagement'). MUST be distinct." },
                    content: { type: Type.STRING, description: "Information-dense content. Mix short descriptive paragraphs (3-4 sentences) with bullet points. Max 100 words per card." },
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
                        description: "Include visual elements (charts/tables/images) for Results/Findings/Methods.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                type: { type: Type.STRING, description: "The type of visual.", enum: ['donutChart', 'lineChart', 'barChart', 'image', 'table'] },
                                items: { type: Type.ARRAY, description: "For donut charts.", items: { type: Type.OBJECT, properties: { label: { type: Type.STRING }, value: { type: Type.NUMBER }, color: { type: Type.STRING } } } },
                                labels: { type: Type.ARRAY, description: "For line/bar charts (X-axis).", items: { type: Type.STRING } },
                                datasets: { type: Type.ARRAY, description: "For line/bar charts.", items: { type: Type.OBJECT, properties: { label: { type: Type.STRING }, data: { type: Type.ARRAY, items: { type: Type.NUMBER } }, color: { type: Type.STRING } } } },
                                url: { type: Type.STRING, description: "Image URL. Format: `https://image.pollinations.ai/prompt/<keywords>?nologo=true`." },
                                caption: { type: Type.STRING },
                                style: { type: Type.STRING, enum: ['normal', 'circular'] },
                                headers: { type: Type.ARRAY, description: "For tables.", items: { type: Type.STRING } },
                                rows: { type: Type.ARRAY, description: "For tables.", items: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.STRING } } } }
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
Your goal is to extract the content from the research text and layout it into a Vertical (Portrait) 2-column poster.

**CORE PRINCIPLE: INTELLIGENT EXTRACTION & FIDELITY**
1.  **EXACT TITLE:** Use the **Exact Title** from the document.
2.  **DEEP READING:** The uploaded document might have different headers or merged sections. You must **INFER** the standard scientific structure.
    *   *Example:* If there is no "Methodology" header, look for "Procedure", "Study Design", or text describing *how* the study was done.
    *   *Example:* If there is no "Conclusion" header, extract the final summarizing paragraphs.
    *   *Example:* "Recommendations" are often hidden at the end of "Discussion" or "Conclusion". Extract them!
3.  **NO HALLUCINATIONS:** Do not invent data. However, you SHOULD reorganize existing text into the required sections.
4.  **NO EARLY STOPS:** You MUST generate the FULL poster structure from Abstract to References.

**REQUIRED STRUCTURE (DO NOT SKIP):**
1.  **Abstract** (Summary)
2.  **Introduction / Objectives** (Context & Goals)
3.  **Methodology** (How it was done)
4.  **Results / Findings** (CRITICAL: Split by key finding. If text lists Finding 1, 2, 3... create separate cards.)
5.  **Discussion** (Interpretation)
6.  **Conclusion** (Summary of impact - **MUST GENERATE**, infer from end of text if needed)
7.  **Recommendations** (Practical applications - **MUST GENERATE**, look in Discussion/Conclusion if missing)
8.  **References** (If citations exist)

**RESULTS SPLITTING RULE:**
*   If the text lists distinct findings (e.g., Finding 1, Finding 2), create a **SEPARATE SECTION** for each.
*   **Titles:** Use specific titles like "Results: [Topic]".

**CONTENT STYLE:**
*   **Dense & Concise:** Use short, information-dense paragraphs (3-4 sentences) mixed with bullet points.
*   **Word Count:** Target ~80-100 words per section to ensure the entire poster fits within the token limit.
*   **Layout:** Col 1 (Abstract -> Methods). Col 2 (Results -> References).
`;

// Helper to sanitize and deduplicate sections
const sanitizeData = (data: any): PosterData => {
    // Default structure to prevent crashes if JSON is partial
    const defaultData: PosterData = {
        title: "Untitled Poster",
        authors: [],
        university: "Unknown University",
        department: "Unknown Department",
        theme: {
            backgroundColor: "#F0F4F8",
            headerColor: "#2C3E50",
            titleColor: "#FFFFFF",
            headingColor: "#1A5276",
            textColor: "#34495E",
            accentColor: "#3498DB",
            sectionBackgroundColor: "#FFFFFF",
            sectionBodyColor: "#34495E"
        },
        sections: [],
        contactInfo: {
            email: "",
            phone: "",
            location: "",
            website: "",
            qrCodeUrl: ""
        },
        leftLogoUrl: "",
        rightLogoUrl: "",
        warnings: []
    };

    if (!data || typeof data !== 'object') {
        return defaultData;
    }

    // Merge logic
    const mergedData = { ...defaultData, ...data };
    
    // Ensure nested objects exist
    if (data.theme) mergedData.theme = { ...defaultData.theme, ...data.theme };
    if (data.contactInfo) mergedData.contactInfo = { ...defaultData.contactInfo, ...data.contactInfo };
    if (data.warnings && Array.isArray(data.warnings)) mergedData.warnings = data.warnings;

    if (!mergedData.sections || !Array.isArray(mergedData.sections)) {
        mergedData.sections = [];
    }

    // --- SMART DEDUPLICATION & MERGING LOGIC ---
    const uniqueSections: PosterSection[] = [];
    const titleMap = new Map<string, PosterSection>();

    mergedData.sections.forEach((section: any) => {
        // 1. Ensure ID exists
        if (!section.id) {
            section.id = `section-${Math.random().toString(36).substr(2, 9)}-${Date.now()}`;
        }

        // 2. Sanitize Column
        let col = String(section.column).replace(/column\s*/i, '').trim();
        if (!['1', '2'].includes(col)) {
            const titleLower = section.title?.toLowerCase() || '';
            if (titleLower.includes('abstract') || titleLower.includes('intro') || titleLower.includes('method') || titleLower.includes('objective')) {
                col = '1';
            } else {
                col = '2'; 
            }
        }
        section.column = col as '1' | '2' | '3'; 

        // 3. Normalize Visuals to Array
        if (section.visual) {
            if (!section.visuals) section.visuals = [];
            section.visuals.push(section.visual);
            delete section.visual;
        }
        if (!section.visuals) section.visuals = [];

        // 4. MERGING LOGIC based on TITLE
        // We normalize the title (lowercase, trimmed) to find duplicates
        const normalizedTitle = section.title?.trim().toLowerCase();
        
        // Exception: Do not merge "Results" if they have different suffixes like "Results: A" vs "Results: B"
        // But if exact duplicate "Results", merge them.
        if (titleMap.has(normalizedTitle)) {
            // Found a duplicate title! Merge content instead of deleting.
            const existingSection = titleMap.get(normalizedTitle)!;
            
            // Append content if it's not exactly the same
            if (section.content && !existingSection.content.includes(section.content.substring(0, 50))) {
                 existingSection.content += "\n\n" + section.content;
            }

            // Append visuals
            if (section.visuals && section.visuals.length > 0) {
                existingSection.visuals = [...(existingSection.visuals || []), ...section.visuals];
            }
        } else {
            // New unique section
            titleMap.set(normalizedTitle, section);
            uniqueSections.push(section);
        }
    });

    mergedData.sections = uniqueSections;
    return mergedData;
};

const parseJsonResponse = (text: string): PosterData | { error: string } => {
    // 1. Clean markdown code blocks
    let cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();

    // 2. Balanced Brace Extractor (String Aware & Stack-Based Auto-Repair)
    const extractBalancedJSON = (str: string) => {
        const start = str.indexOf('{');
        if (start === -1) return str;

        const stack: string[] = [];
        let inString = false;
        let escape = false;
        
        // We look for the end of the JSON structure
        const jsonStr = str.substring(start);
        let i = 0;
        
        for (i = 0; i < jsonStr.length; i++) {
            const char = jsonStr[i];
            
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
                    stack.push('}');
                } else if (char === '[') {
                    stack.push(']');
                } else if (char === '}' || char === ']') {
                     if (stack.length > 0 && stack[stack.length - 1] === char) {
                        stack.pop();
                    }
                }
            }
            
            // If stack is empty and we have processed content, we are done
            if (stack.length === 0 && i > 0) {
                 return str.substring(start, start + i + 1);
            }
        }
        
        // If we reach here, the JSON is truncated or malformed.
        // Auto-repair logic:
        let repaired = jsonStr;
        
        if (inString) {
            repaired += '"';
        }
        
        // Close remaining open structures in reverse order
        while (stack.length > 0) {
            repaired += stack.pop();
        }
        
        return repaired;
    };

    cleanText = extractBalancedJSON(cleanText);

    try {
        const rawData = JSON.parse(cleanText);
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
                'design', 'icon', 'variant', 'customColor', 'warnings'
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
             
             const rawData = JSON.parse(fixedText);
             return sanitizeData(rawData);
        } catch (e2) {
             const errorDetails = e instanceof Error ? e.message : String(e);
             console.error("JSON fixing failed:", errorDetails);
             console.warn("Fixed JSON:", cleanText); // Log attempted fix
             return { error: `We encountered a formatting issue with the AI's response. Please try generating again, or use a shorter input text to reduce complexity.` };
        }
    }
};

export const startPosterChat = async (
    designPrompt: string,
    fileContent: string,
    setLoadingMessage: (message: string) => void
): Promise<{ posterData?: PosterData; chat?: Chat; error?: string }> => {
    setLoadingMessage("Analyzing research data and identifying gaps...");
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Switched back to 'gemini-2.5-flash' for speed.
    // It still has 1M context window so it can read long files.
    // The strict systemInstruction should handle the structure requirements.
    const chat = ai.chats.create({
        model: 'gemini-2.5-flash', 
        config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: posterSchema,
        },
    });

    // Truncate file content to safe limit
    // 800,000 characters is safe for 1M context window of Flash
    const truncatedContent = fileContent.slice(0, 800000); 

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

export const generateAlternativePoster = async (
    chat: Chat
): Promise<PosterData | { error: string }> => {
    try {
        const altPrompt = "Create a DISTINCT alternative version of this poster. Change the layout structure (e.g. icon styles, column balance) and the color theme significantly from the previous output. Ensure the content remains scientifically accurate but present it with a different visual strategy. Remember: KEEP CONTENT CONCISE, DENSE AND MIX PARAGRAPHS WITH LISTS. USE THE EXACT TITLE.";
        const result = await chat.sendMessage({ message: altPrompt });
        const posterData = parseJsonResponse(result.text);

        if ('error' in posterData) {
            return { error: posterData.error };
        }
        
        return posterData;
    } catch (e: any) {
        console.error("Error generating alternative poster:", e);
        return { error: e.message || "An unknown error occurred during variation generation." };
    }
};