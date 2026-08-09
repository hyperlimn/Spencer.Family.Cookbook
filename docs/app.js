const state={recipes:[],filtered:[],query:"",category:null,contributor:null,review:false};
const $=s=>document.querySelector(s);
const escapeHtml=s=>String(s??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const counts=(items,key)=>items.reduce((a,r)=>{const v=r[key];if(v)a[v]=(a[v]||0)+1;return a},{});

async function init(){
  const data=await fetch("data/recipes.json").then(r=>r.json());state.recipes=data.recipes;
  $("#stats").textContent=`${data.recipes.length} recipes · ${data.contributors.length} contributors · 9 chapters`;
  renderFilters();apply();
  const slug=location.hash.slice(1);if(slug)openRecipe(state.recipes.find(r=>r.slug===slug));
}
function renderFilters(){
  const cats=counts(state.recipes,"category"),people=counts(state.recipes,"contributor");
  $("#categories").innerHTML=Object.entries(cats).map(([x,n])=>`<button data-category="${escapeHtml(x)}">${escapeHtml(x)}<small>${n}</small></button>`).join("");
  $("#contributors").innerHTML=Object.entries(people).sort(([a],[b])=>a.localeCompare(b)).map(([x,n])=>`<button data-contributor="${escapeHtml(x)}">${escapeHtml(x)}<small>${n}</small></button>`).join("");
}
function apply(){
  const q=state.query.toLocaleLowerCase();
  state.filtered=state.recipes.filter(r=>(!state.category||r.category===state.category)&&(!state.contributor||r.contributor===state.contributor)&&(!state.review||r.needs_review)&&(!q||[r.title,r.contributor,r.category,...r.ingredients,...r.directions].join(" ").toLocaleLowerCase().includes(q)));
  $("#result-title").textContent=state.category||state.contributor||(state.review?"Recipes to review":"All recipes");
  $("#count").textContent=`${state.filtered.length} ${state.filtered.length===1?"recipe":"recipes"}`;
  $("#recipe-grid").innerHTML=state.filtered.map(r=>`<button class="recipe-card" data-slug="${r.slug}"><span class="category">${escapeHtml(r.category)}</span><h3>${escapeHtml(r.title)}</h3><span class="by">${r.contributor?`From ${escapeHtml(r.contributor)}`:"From the family collection"}</span><span class="page">Book page ${r.source_pages.join(", ")}${r.needs_review?' <span class="review-dot" title="Needs transcription review">●</span>':""}</span></button>`).join("");
  $("#empty").hidden=state.filtered.length>0;
  document.querySelectorAll("[data-category]").forEach(b=>b.classList.toggle("active",b.dataset.category===state.category));
  document.querySelectorAll("[data-contributor]").forEach(b=>b.classList.toggle("active",b.dataset.contributor===state.contributor));
}
function openRecipe(r){if(!r)return;const page=r.pdf_page;$("#recipe-detail").innerHTML=`<button class="close" aria-label="Close">×</button><span class="detail-category">${escapeHtml(r.category)}</span><h2 class="detail-title">${escapeHtml(r.title)}</h2><p class="detail-by">${r.contributor?`Contributed by ${escapeHtml(r.contributor)}`:"From the family collection"}</p><div class="detail-grid"><section><h3>Ingredients</h3><ul class="ingredients">${r.ingredients.length?r.ingredients.map(x=>`<li>${escapeHtml(x)}</li>`).join(""):'<li>See source transcription</li>'}</ul></section><section class="directions"><h3>Directions</h3>${r.directions.map(x=>`<p>${escapeHtml(x)}</p>`).join("")}</section></div><div class="source-note">${r.needs_review?'<span class="review-dot">● Transcription needs review</span>':""}<a href="cookbook.pdf#page=${page}" target="_blank">View original book page ${r.source_pages.join(", ")}</a><a href="https://github.com/hyperlimn/Spencer.Family.Cookbook/edit/main/${r.file}" target="_blank">Edit this recipe</a></div>`;
  $("#recipe-dialog").showModal();location.hash=r.slug;$(".close").onclick=closeRecipe;
}
function closeRecipe(){$("#recipe-dialog").close();history.replaceState(null,"",location.pathname+location.search)}
document.addEventListener("click",e=>{const card=e.target.closest("[data-slug]");if(card)openRecipe(state.recipes.find(r=>r.slug===card.dataset.slug));const c=e.target.closest("[data-category]");if(c){state.category=state.category===c.dataset.category?null:c.dataset.category;apply()}const p=e.target.closest("[data-contributor]");if(p){state.contributor=state.contributor===p.dataset.contributor?null:p.dataset.contributor;apply()}});
$("#search").addEventListener("input",e=>{state.query=e.target.value;apply()});$("#review-only").addEventListener("change",e=>{state.review=e.target.checked;apply()});
$("#clear").onclick=()=>{state.query="";state.category=state.contributor=null;state.review=false;$("#search").value="";$("#review-only").checked=false;apply()};
$("#surprise").onclick=()=>openRecipe(state.recipes[Math.floor(Math.random()*state.recipes.length)]);
$("#recipe-dialog").addEventListener("click",e=>{if(e.target===$("#recipe-dialog"))closeRecipe()});document.addEventListener("keydown",e=>{if(e.key==="/"&&!/input|textarea/i.test(e.target.tagName)){e.preventDefault();$("#search").focus()}});
init().catch(()=>{$("#recipe-grid").innerHTML="<p>The recipe catalog could not be loaded.</p>"});
