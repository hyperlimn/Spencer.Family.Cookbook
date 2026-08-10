const ui={
  search:document.querySelector("#search-input"),clearSearch:document.querySelector("#clear-search"),
  categories:document.querySelector("#categories"),contributors:document.querySelector("#contributors"),
  review:document.querySelector("#review-only"),grid:document.querySelector("#recipe-grid"),
  empty:document.querySelector("#empty"),count:document.querySelector("#count"),
  title:document.querySelector("#result-title"),context:document.querySelector("#result-context"),
  dialog:document.querySelector("#recipe-dialog"),detail:document.querySelector("#recipe-detail"),
  face:document.querySelector("#face-select"),dark:document.querySelector("#dark-mode")
};
const state={recipes:[],query:"",category:"",contributor:"",reviewOnly:false};
const escapeHtml=value=>String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
const normalize=value=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const countBy=key=>state.recipes.reduce((result,recipe)=>{const value=recipe[key];if(value)result[value]=(result[value]||0)+1;return result},{});

function setAppearance(){
  const savedFace=localStorage.getItem("cookbook-face")||"minimal";
  const savedTheme=localStorage.getItem("cookbook-theme")||"light";
  document.documentElement.dataset.face=savedFace;document.documentElement.dataset.theme=savedTheme;
  ui.face.value=savedFace;ui.dark.checked=savedTheme==="dark";
}
function renderFilters(){
  ui.categories.innerHTML=Object.entries(countBy("category")).map(([name,count])=>`<button type="button" data-category="${escapeHtml(name)}"><span>${escapeHtml(name)}</span><small>${count}</small></button>`).join("");
  ui.contributors.innerHTML=Object.entries(countBy("contributor")).sort(([a],[b])=>a.localeCompare(b)).map(([name,count])=>`<button type="button" data-contributor="${escapeHtml(name)}"><span>${escapeHtml(name)}</span><small>${count}</small></button>`).join("");
}
function matchingRecipes(){
  const query=normalize(state.query).trim();
  return state.recipes.filter(recipe=>(!state.category||recipe.category===state.category)&&(!state.contributor||recipe.contributor===state.contributor)&&(!state.reviewOnly||recipe.needs_review)&&(!query||recipe.searchText.includes(query)));
}
function render(){
  const recipes=matchingRecipes();
  ui.title.textContent=state.query?`Results for “${state.query.trim()}”`:state.category||state.contributor||(state.reviewOnly?"Needs review":"All recipes");
  ui.context.textContent=state.query?"Titles, ingredients, directions, and contributors":state.category||state.contributor?"Filtered collection":"The complete family collection";
  ui.count.textContent=`${recipes.length} ${recipes.length===1?"recipe":"recipes"}`;ui.clearSearch.hidden=!state.query;
  ui.grid.innerHTML=recipes.map(recipe=>`<button type="button" class="recipe-card" data-recipe="${recipe.slug}"><span class="category">${escapeHtml(recipe.category)}</span><h2>${escapeHtml(recipe.title)}</h2><span class="by">${recipe.contributor?`From ${escapeHtml(recipe.contributor)}`:"Family collection"}</span><span class="page">Page ${recipe.source_pages.join(", ")}${recipe.needs_review?' <span class="review-dot" title="Needs review">●</span>':""}</span></button>`).join("");
  ui.empty.hidden=recipes.length!==0;ui.grid.hidden=recipes.length===0;
  document.querySelectorAll("[data-category]").forEach(button=>button.classList.toggle("active",button.dataset.category===state.category));
  document.querySelectorAll("[data-contributor]").forEach(button=>button.classList.toggle("active",button.dataset.contributor===state.contributor));
}
function openRecipe(recipe){
  if(!recipe)return;
  ui.detail.innerHTML=`<button type="button" class="close" aria-label="Close recipe">×</button><span class="detail-category">${escapeHtml(recipe.category)}</span><h1 class="detail-title">${escapeHtml(recipe.title)}</h1><p class="detail-by">${recipe.contributor?`Contributed by ${escapeHtml(recipe.contributor)}`:"From the family collection"}</p><div class="detail-grid"><section><h2>Ingredients</h2><ul class="ingredients">${recipe.ingredients.length?recipe.ingredients.map(item=>`<li>${escapeHtml(item)}</li>`).join(""):'<li>See original page</li>'}</ul></section><section class="directions"><h2>Directions</h2>${recipe.directions.map(step=>`<p>${escapeHtml(step)}</p>`).join("")}</section></div><div class="source-note">${recipe.needs_review?'<span class="review-dot">● Needs transcription review</span>':""}<a href="cookbook.pdf#page=${recipe.pdf_page}" target="_blank">Original page ${recipe.source_pages.join(", ")}</a><a href="https://github.com/hyperlimn/Spencer.Family.Cookbook/edit/main/${recipe.file}" target="_blank">Edit recipe</a></div>`;
  ui.dialog.showModal();history.replaceState(null,"",`#${recipe.slug}`);ui.detail.querySelector(".close").addEventListener("click",closeRecipe);
}
function closeRecipe(){ui.dialog.close();history.replaceState(null,"",location.pathname+location.search)}
function reset(){state.query=state.category=state.contributor="";state.reviewOnly=false;ui.search.value="";ui.review.checked=false;render()}

document.querySelector("#search-form").addEventListener("submit",event=>{event.preventDefault();state.query=ui.search.value;render()});
ui.search.addEventListener("input",event=>{state.query=event.currentTarget.value;render()});
ui.clearSearch.addEventListener("click",()=>{state.query="";ui.search.value="";ui.search.focus();render()});
document.querySelector("#clear-filters").addEventListener("click",reset);
ui.review.addEventListener("change",event=>{state.reviewOnly=event.currentTarget.checked;render()});
ui.face.addEventListener("change",event=>{document.documentElement.dataset.face=event.currentTarget.value;localStorage.setItem("cookbook-face",event.currentTarget.value)});
ui.dark.addEventListener("change",event=>{const theme=event.currentTarget.checked?"dark":"light";document.documentElement.dataset.theme=theme;localStorage.setItem("cookbook-theme",theme)});
document.addEventListener("click",event=>{const category=event.target.closest("[data-category]");const contributor=event.target.closest("[data-contributor]");const card=event.target.closest("[data-recipe]");if(category){state.category=state.category===category.dataset.category?"":category.dataset.category;render()}if(contributor){state.contributor=state.contributor===contributor.dataset.contributor?"":contributor.dataset.contributor;render()}if(card)openRecipe(state.recipes.find(recipe=>recipe.slug===card.dataset.recipe))});
document.querySelector("#surprise").addEventListener("click",()=>openRecipe(state.recipes[Math.floor(Math.random()*state.recipes.length)]));
ui.dialog.addEventListener("click",event=>{if(event.target===ui.dialog)closeRecipe()});
document.addEventListener("keydown",event=>{if(event.key==="/"&&!/input|textarea|select/i.test(event.target.tagName)){event.preventDefault();ui.search.focus()}});

async function init(){
  setAppearance();
  try{
    const response=await fetch("data/recipes.json",{cache:"no-store"});if(!response.ok)throw new Error(`Catalog ${response.status}`);
    const data=await response.json();state.recipes=data.recipes.map(recipe=>({...recipe,searchText:normalize([recipe.title,recipe.contributor,recipe.category,...recipe.ingredients,...recipe.directions].join(" "))}));
    document.querySelector("#collection-stats").textContent=`${state.recipes.length} recipes · ${data.contributors.length} contributors`;
    renderFilters();render();const slug=decodeURIComponent(location.hash.slice(1));if(slug)openRecipe(state.recipes.find(recipe=>recipe.slug===slug));
  }catch(error){ui.count.textContent="Unavailable";ui.grid.innerHTML=`<p class="load-error">The recipe catalog could not be loaded. Please refresh the page.</p>`;console.error(error)}
}
init();
