"""
LinkedIn Agent — Génère et publie des posts LinkedIn sur la data engineering.

Sources de contenu :
  - Insights des workflows AO traités
  - Tendances data engineering (auto-générées par LLM)
  - Actualités BOAMP (secteur numérique)

Publication :
  - Via API LinkedIn (OAuth2) si configuré
  - Sinon : génère le texte, l'utilisateur publie manuellement
"""

from __future__ import annotations
import logging
import os
from datetime import datetime

log = logging.getLogger("datasphere.linkedin")

# ── Post templates by topic ───────────────────────────────────────────────────

TOPIC_PROMPTS = {
    "data_engineering": """Tu es Cheickna KABA, Senior Data Engineer freelance basé à Paris.
Rédige un post LinkedIn professionnel (250-350 mots) sur un sujet data engineering :
{topic}

Style : expert mais accessible, concret, avec un exemple ou retour d'expérience.
Ton : professionnel mais humain, pas de jargon inutile.
Inclure :
  - Une accroche forte (1-2 phrases percutantes)
  - 3-4 points clés avec insights pratiques
  - Une question pour engager la communauté
  - 5 hashtags pertinents (#DataEngineering #Snowflake #dbt etc.)
NE PAS inclure d'émojis excessifs. Maximum 2 émojis stratégiques.
""",

    "ao_insight": """Tu es Cheickna KABA, consultant Data/IA freelance expert en réponse aux appels d'offres.
Un appel d'offres vient d'être traité avec succès :

{ao_context}

Rédige un post LinkedIn anonymisé (ne cite pas l'acheteur) partageant :
  - La complexité data/IA demandée dans ce type de marché
  - L'approche technique choisie (stack, architecture)
  - Un conseil pratique pour les consultants data qui répondent à ce type d'AO
  - Une conclusion sur les tendances du marché

250-320 mots. 4 hashtags maximum. Ton expert et authentique.
""",

    "market_trend": """Tu es Cheickna KABA, Data Architect freelance.
Rédige un post LinkedIn sur la tendance du marché data en France/Afrique :
{topic}

Format :
  - Titre accrocheur
  - Contexte marché (2-3 phrases)
  - Ce que ça change concrètement pour les data engineers
  - Conseil pratique ou recommandation de stack
  - Appel à l'action
280-350 mots. Hashtags pertinents.
""",
}

DEFAULT_TOPICS = [
    "La montée en puissance de dbt Core dans les SI des grandes entreprises françaises",
    "Snowflake vs Databricks : comment choisir en 2025 pour un marché public",
    "Medallion Architecture : pourquoi c'est devenu le standard des data lakes",
    "Apache Airflow vs Prefect : retour d'expérience sur 5 projets data",
    "L'IA générative dans la data : use cases réels vs hype",
    "Freelance Data Engineer en France : TJM, missions, comment se positionner",
    "PySpark sur Kubernetes : les pièges à éviter en production",
    "Data Engineering en Afrique francophone : opportunités et défis 2025",
]


def generate_post(
    topic_type: str = "data_engineering",
    topic: str | None = None,
    ao_context: str | None = None,
) -> dict:
    """
    Generate a LinkedIn post using the active LLM provider.
    Returns dict with: content, topic, generated_at, word_count, hashtags
    """
    from app.services.llm_service import complete

    if topic is None:
        import random
        topic = random.choice(DEFAULT_TOPICS)

    system_prompt = TOPIC_PROMPTS.get(topic_type, TOPIC_PROMPTS["data_engineering"])

    if topic_type == "ao_insight" and ao_context:
        prompt = system_prompt.format(ao_context=ao_context)
    else:
        prompt = system_prompt.format(topic=topic)

    content, provider = complete(
        prompt=prompt,
        system="Tu es un expert data engineering qui partage son expertise sur LinkedIn. Sois authentique, précis et apporteur de valeur.",
        action_type="commercial_proposal",
    )

    # Extract hashtags
    import re
    hashtags = re.findall(r'#\w+', content)

    return {
        "content":      content,
        "topic":        topic,
        "topic_type":   topic_type,
        "provider":     provider,
        "generated_at": datetime.utcnow().isoformat(),
        "word_count":   len(content.split()),
        "char_count":   len(content),
        "hashtags":     hashtags,
    }


def generate_from_tender(tender_title: str, tender_summary: str | None, workflow_result: str | None) -> dict:
    """Generate a LinkedIn post from a completed AO workflow."""
    ao_context = f"Titre AO : {tender_title}"
    if tender_summary:
        ao_context += f"\nContexte : {tender_summary[:300]}"
    if workflow_result:
        ao_context += f"\nPoints clés du mémoire : {workflow_result[:400]}"

    return generate_post(topic_type="ao_insight", ao_context=ao_context)


def publish_to_linkedin(content: str, access_token: str) -> dict:
    """
    Publish a post to LinkedIn via the API.
    Requires a valid LinkedIn OAuth2 access token.
    """
    import urllib.request
    import json

    # Get LinkedIn user ID first
    me_req = urllib.request.Request(
        "https://api.linkedin.com/v2/userinfo",
        headers={"Authorization": f"Bearer {access_token}"}
    )

    try:
        with urllib.request.urlopen(me_req, timeout=10) as resp:
            me = json.load(resp)
            person_id = me.get("sub")
    except Exception as e:
        return {"success": False, "error": f"Impossible de récupérer le profil LinkedIn : {e}"}

    # Post the content
    payload = {
        "author": f"urn:li:person:{person_id}",
        "lifecycleState": "PUBLISHED",
        "specificContent": {
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": {"text": content},
                "shareMediaCategory": "NONE",
            }
        },
        "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
    }

    post_req = urllib.request.Request(
        "https://api.linkedin.com/v2/ugcPosts",
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type":  "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(post_req, timeout=15) as resp:
            result = json.load(resp)
            return {
                "success": True,
                "post_id": result.get("id"),
                "url": f"https://www.linkedin.com/feed/update/{result.get('id', '')}",
            }
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        return {"success": False, "error": f"LinkedIn API {e.code}: {body[:200]}"}
    except Exception as e:
        return {"success": False, "error": str(e)}
