import { useState, useCallback, useEffect } from 'react';
import { CreateWebWorkerMLCEngine, InitProgressCallback, MLCEngineInterface, ChatCompletionMessageParam, hasModelInCache } from '@mlc-ai/web-llm';

// Modèle local (WebLLM/WebGPU) pour l'assistant langage -> SQL.
//
// Qwen2.5-Coder-1.5B : le meilleur PETIT modèle sur le texte->SQL (spécialisé code, il bat
// nettement un généraliste comme Llama-3.2-1B à taille comparable). Quantifié q4f16, il pèse
// à peine plus que l'ancien Llama-1B q4f32 (~950 Mo vs 850) pour une qualité SQL bien
// supérieure. VRAM ~1,6 Go : sans risque — seul le modèle 3B provoquait un crash WebGPU.
// Alternative plus légère si besoin : 'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC' (moitié du
// poids, mais moins fiable sur les requêtes complexes).
export const DEFAULT_MODEL = 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC';

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
        // Génération de SQL : température 0 (déterministe, plus fiable) et AUCUNE pénalité de
        // fréquence — un frequency_penalty > 0 pénalise les mots-clés SQL forcément répétés
        // (JOIN, ON, =…) et dégrade nettement la sortie. Mesuré sur banc de test.
        temperature: 0,
        frequency_penalty: 0,
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
        temperature: 0,
      });
      return reply.choices[0].message.content as string;
    }
  }, [engine]);

  return { engine, loading, progressText, progressPercent, isCached, init, generate };
}
