// The words of the sentence under every chart: the templates in config/narrative/chart_sentences.json, without their comments.
import doc from "../../config/narrative/chart_sentences.json";
import type { SentenceTemplates } from "./chartSentence";

export const chartSentences: SentenceTemplates = Object.fromEntries(Object.entries(doc).filter(([key]) => !key.startsWith("$"))) as SentenceTemplates;
