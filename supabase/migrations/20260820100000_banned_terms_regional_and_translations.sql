-- Adds: (1) English "cum" (word-boundary safe - verified it doesn't
-- collide with "cumulative", "document", "circumstance", "cucumber",
-- "succumb", "incumbent", "accumulate", none of which contain "cum" as
-- a boundary-delimited token); (2) a batch of Cantonese/Hokkien/Taiwanese
-- regional terms; (3) expanded Spanish and Mandarin translations of the
-- existing English categories.
--
-- Deliberately excluded from the requested regional batch:
--   - 靠北 / 靠夭: extremely common, mild Taiwanese exclamations (closer
--     to "geez"/"damn it" in everyday use than a slur) - blocking these
--     would misfire on ordinary conversation the same way banning
--     "suicide" or "torture" as bare words would.
--   - 鬼佬: context-dependent - frequently used neutrally/casually for
--     Western foreigners (similar to "gringo"), sometimes even
--     self-referentially. Too inconsistent to hard-block.
--   - bare 屌: the direct Cantonese equivalent of "fuck", used
--     constantly as general cussing rather than a targeted slur - kept
--     屌你老母 (the targeted phrase) instead, consistent with not
--     banning bare "fuck" in English.
--   - 支那豬: redundant, already caught by the existing 支那 substring
--     entry.
insert into public.banned_terms (term, language, category) values
  ('cum', 'en', 'sexual_explicit');

insert into public.banned_terms (term, language, category, match_mode) values
  -- Ethnic / regional slurs
  ('番仔', 'zh', 'slur_racial', 'substring'),
  ('外省豬', 'zh', 'slur_racial', 'substring'),
  ('燦神', 'zh', 'slur_racial', 'substring'),
  ('阿燦', 'zh', 'slur_racial', 'substring'),
  ('北姑', 'zh', 'slur_racial', 'substring'),
  ('賓妹', 'zh', 'slur_racial', 'substring'),
  ('𦧲仔', 'zh', 'slur_racial', 'substring'),

  -- Gendered harassment
  ('破麻', 'zh', 'harassment_gendered', 'substring'),

  -- Severe general vulgarity / targeted vulgar insults
  ('洨', 'zh', 'vulgar_severe', 'substring'),
  ('雞掰', 'zh', 'vulgar_severe', 'substring'),
  ('操雞掰', 'zh', 'vulgar_severe', 'substring'),
  ('臭雞掰', 'zh', 'vulgar_severe', 'substring'),
  ('幹你娘', 'zh', 'vulgar_severe', 'substring'),
  ('幹林老木', 'zh', 'vulgar_severe', 'substring'),
  ('塞你公', 'zh', 'vulgar_severe', 'substring'),
  ('𨳒', 'zh', 'vulgar_severe', 'substring'),
  ('屌你老母', 'zh', 'vulgar_severe', 'substring'),
  ('dllm', 'zh', 'vulgar_severe', 'substring'),
  ('閪', 'zh', 'vulgar_severe', 'substring'),
  ('臭閪', 'zh', 'vulgar_severe', 'substring'),
  ('鳩', 'zh', 'vulgar_severe', 'substring'),
  ('𨳊', 'zh', 'vulgar_severe', 'substring'),
  ('撚', 'zh', 'vulgar_severe', 'substring'),
  ('柒', 'zh', 'vulgar_severe', 'substring'),
  ('柒頭', 'zh', 'vulgar_severe', 'substring'),
  ('仆街', 'zh', 'vulgar_severe', 'substring'),
  ('戇鳩', 'zh', 'vulgar_severe', 'substring'),

  -- Extreme hostility (death-wish curse)
  ('冚家剷', 'zh', 'violence_extreme', 'substring'),

  -- Mandarin equivalents for categories not yet covered in Chinese
  ('人妖', 'zh', 'slur_homophobic', 'substring'),
  ('智障', 'zh', 'slur_ableist', 'substring'),
  ('弱智', 'zh', 'slur_ableist', 'substring'),
  ('強姦', 'zh', 'sexual_violence', 'substring'),
  ('戀童癖', 'zh', 'sexual_violence', 'substring'),
  ('兒童色情', 'zh', 'child_exploitation', 'substring'),
  ('人口販賣', 'zh', 'trafficking', 'substring'),
  ('兒童販賣', 'zh', 'trafficking', 'substring');

insert into public.banned_terms (term, language, category) values
  -- Spanish - racial/ethnic
  ('moro de mierda', 'es', 'slur_racial'),
  ('gitano de mierda', 'es', 'slur_racial'),
  ('panchito', 'es', 'slur_racial'),
  ('chino de mierda', 'es', 'slur_racial'),
  ('negro de mierda', 'es', 'slur_racial'),

  -- Spanish - ableist
  ('retrasado', 'es', 'slur_ableist'),
  ('mongolico', 'es', 'slur_ableist'),

  -- Spanish - sexual violence / child exploitation
  ('violacion', 'es', 'sexual_violence'),
  ('pederasta', 'es', 'sexual_violence'),
  ('pornografia infantil', 'es', 'child_exploitation'),
  ('abusador de menores', 'es', 'child_exploitation'),

  -- Spanish - self-harm incitement
  ('ojala te mueras', 'es', 'self_harm_incitement'),

  -- Spanish - weapons/attack (mirrors the English generic trigger phrases)
  ('como hacer una bomba', 'es', 'weapons_attack'),
  ('bomba casera', 'es', 'weapons_attack'),
  ('tiroteo escolar', 'es', 'weapons_attack');
