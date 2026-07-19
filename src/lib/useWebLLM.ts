import { useState, useCallback, useEffect } from 'react';
import { CreateWebWorkerMLCEngine, InitProgressCallback, MLCEngineInterface, ChatCompletionMessageParam, hasModelInCache } from '@mlc-ai/web-llm';

// Reverted to Llama-3.2-1B f32. The 3B model is too heavy for the GPU
// and causes a complete WebGPU crash at the browser level!
export const DEFAULT_MODEL = 'Llama-3.2-1B-Instruct-q4f32_1-MLC';

export function useWebLLM() {
  const [engine, setEngine] = useState<MLCEngineInterface | null>(null);
  const [loading, setLoading] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [isCached, setIsCached] = useState(false);

  useEffect(() => {
    hasModelInCache(DEFAULT_MODEL).then((cached) => setIsCached(cached)).catch(() => setIsCached(false));
  }, []);

  const init = useCallback(async (modelId: string = DEFAULT_MODEL) => {
    if (engine) return;
    setLoading(true);
    setProgressText('Initialisation...');
    
    const initProgressCallback: InitProgressCallback = (initProgress) => {
      setProgressText(initProgress.text);
      setProgressPercent(Math.round(initProgress.progress * 100));
    };

    try {
      const worker = new Worker(new URL('./webllmWorker.ts', import.meta.url), { type: 'module' });
      const newEngine = await CreateWebWorkerMLCEngine(
        worker,
        modelId,
        { initProgressCallback }
      );
      setEngine(newEngine);
    } catch (error) {
      console.error("Failed to initialize WebLLM engine:", error);
      setProgressText('Erreur lors du chargement du modèle.');
    } finally {
      setLoading(false);
      setProgressText('');
    }
  }, [engine]);

  const generate = useCallback(async (
    messages: ChatCompletionMessageParam[], 
    systemPrompt?: string,
    onUpdate?: (currentText: string) => void
  ) => {
    if (!engine) throw new Error("L'IA n'est pas encore initialisée.");
    
    const fullMessages: ChatCompletionMessageParam[] = [];
    if (systemPrompt) {
      fullMessages.push({ role: 'system', content: systemPrompt });
    }
    fullMessages.push(...messages);

    if (onUpdate) {
      const asyncChunkGenerator = await engine.chat.completions.create({
        messages: fullMessages,
        temperature: 0.1,
        frequency_penalty: 1.0,
        stream: true,
      });

      let responseText = "";
      for await (const chunk of asyncChunkGenerator) {
        if (chunk.choices[0]?.delta?.content) {
          responseText += chunk.choices[0].delta.content;
          onUpdate(responseText);
        }
      }
      return responseText;
    } else {
      const reply = await engine.chat.completions.create({
        messages: fullMessages,
        temperature: 0.1,
      });
      return reply.choices[0].message.content as string;
    }
  }, [engine]);

  return { engine, loading, progressText, progressPercent, isCached, init, generate };
}
