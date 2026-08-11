const ui={
  search:document.querySelector("#search-input"),clearSearch:document.querySelector("#clear-search"),
  categories:document.querySelector("#categories"),contributors:document.querySelector("#contributors"),
  grid:document.querySelector("#recipe-grid"),
  empty:document.querySelector("#empty"),count:document.querySelector("#count"),
  title:document.querySelector("#result-title"),context:document.querySelector("#result-context"),
  dialog:document.querySelector("#recipe-dialog"),detail:document.querySelector("#recipe-detail"),
  face:document.querySelector("#face-select"),dark:document.querySelector("#dark-mode"),
  addDialog:document.querySelector("#add-dialog"),recent:document.querySelector("#recent-additions"),recentList:document.querySelector("#recent-list"),
  devDialog:document.querySelector("#dev-dialog"),devSearch:document.querySelector("#dev-search"),devList:document.querySelector("#dev-list"),
  submissionToast:document.querySelector("#submission-toast")
};
const state={recipes:[],query:"",category:"",contributor:""};
const repository="https://github.com/hyperlimn/Spencer.Family.Cookbook";
const recipeSubmissionEndpoint="https://spencer-family-cookbook.hyperlimn.workers.dev";
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
  const recent=state.recipes.filter(recipe=>recipe.date_added).sort((a,b)=>String(b.date_added).localeCompare(String(a.date_added))).slice(0,5);
  ui.recent.hidden=recent.length===0;ui.recentList.innerHTML=recent.map(recipe=>`<button type="button" data-recipe="${recipe.slug}"><strong>${escapeHtml(recipe.title)}</strong><small>${escapeHtml(recipe.contributor||"Family collection")} · ${escapeHtml(recipe.date_added)}</small></button>`).join("");
}
function matchingRecipes(){
  const query=normalize(state.query).trim();
  return state.recipes.filter(recipe=>(!state.category||recipe.category===state.category)&&(!state.contributor||recipe.contributor===state.contributor)&&(!query||recipe.searchText.includes(query)));
}
function render(){
  const recipes=matchingRecipes();
  ui.title.textContent=state.query?`Results for “${state.query.trim()}”`:state.category||state.contributor||"All recipes";
  ui.context.textContent=state.query?"Titles, ingredients, directions, and contributors":state.category||state.contributor?"Filtered collection":"The complete family collection";
  ui.count.textContent=`${recipes.length} ${recipes.length===1?"recipe":"recipes"}`;ui.clearSearch.hidden=!state.query;
  ui.grid.innerHTML=recipes.map(recipe=>`<button type="button" class="recipe-card" data-recipe="${recipe.slug}"><span class="category">${escapeHtml(recipe.category)}</span><h2>${escapeHtml(recipe.title)}</h2><span class="by">${recipe.contributor?`From ${escapeHtml(recipe.contributor)}`:"Family collection"}</span><span class="page">${recipe.source_pages?.length?`Page ${recipe.source_pages.join(", ")}`:recipe.date_added?`Added ${escapeHtml(recipe.date_added)}`:""}</span></button>`).join("");
  ui.empty.hidden=recipes.length!==0;ui.grid.hidden=recipes.length===0;
  document.querySelectorAll("[data-category]").forEach(button=>button.classList.toggle("active",button.dataset.category===state.category));
  document.querySelectorAll("[data-contributor]").forEach(button=>button.classList.toggle("active",button.dataset.contributor===state.contributor));
}
function openRecipe(recipe){
  if(!recipe)return;
  const firstPage=recipe.source_pages?.[0];const sourceLink=firstPage?`<a href="cookbook-reading-order.pdf#page=${firstPage+2}" target="_blank">Original page${recipe.source_pages.length>1?"s":""} ${recipe.source_pages.join(", ")}</a>`:"";
  ui.detail.innerHTML=`<button type="button" class="close" aria-label="Close recipe">×</button><span class="detail-category">${escapeHtml(recipe.category)}</span><h1 class="detail-title">${escapeHtml(recipe.title)}</h1><p class="detail-by">${recipe.contributor?`Contributed by ${escapeHtml(recipe.contributor)}`:"From the family collection"}</p><div class="detail-grid"><section><h2>Ingredients</h2><ul class="ingredients">${recipe.ingredients.length?recipe.ingredients.map(item=>`<li>${escapeHtml(item)}</li>`).join(""):'<li>See original page</li>'}</ul></section><section class="directions"><h2>Directions</h2>${recipe.directions.map(step=>`<p>${escapeHtml(step)}</p>`).join("")}</section></div><div class="source-note">${sourceLink}<button type="button" class="expand-recipe">Full screen</button></div>`;
  ui.dialog.showModal();history.replaceState(null,"",`#${recipe.slug}`);ui.detail.querySelector(".close").addEventListener("click",closeRecipe);ui.detail.querySelector(".expand-recipe").addEventListener("click",toggleRecipeSize);
}
function toggleRecipeSize(){const expanded=ui.dialog.classList.toggle("expanded");ui.detail.querySelector(".expand-recipe").textContent=expanded?"Exit full screen":"Full screen";ui.dialog.scrollTop=0}
function closeRecipe(){ui.dialog.classList.remove("expanded");ui.dialog.close();history.replaceState(null,"",location.pathname+location.search)}
function reset(){state.query=state.category=state.contributor="";ui.search.value="";render()}
function repositoryPath(file){return file.split("/").map(encodeURIComponent).join("/")}
function renderDevList(){
  const query=normalize(ui.devSearch.value).trim();const recipes=state.recipes.filter(recipe=>!query||normalize(`${recipe.title} ${recipe.contributor||""}`).includes(query)).slice(0,100);
  ui.devList.innerHTML=recipes.map(recipe=>`<div class="dev-row"><span><strong>${escapeHtml(recipe.title)}</strong><small>${escapeHtml(recipe.contributor||recipe.category)}</small></span><span class="dev-actions"><a href="${repository}/edit/main/${repositoryPath(recipe.file)}" target="_blank">Edit</a>${recipe.date_added?`<a class="delete" href="${repository}/delete/main/${repositoryPath(recipe.file)}" target="_blank">Delete</a>`:""}</span></div>`).join("");
}
function openDevMenu(){document.querySelector("#dev-trigger").classList.remove("unlocking");ui.devSearch.value="";renderDevList();ui.devDialog.showModal()}
let toastTimer;
function showSubmissionToast(message){clearTimeout(toastTimer);ui.submissionToast.textContent=message;ui.submissionToast.hidden=false;toastTimer=setTimeout(()=>ui.submissionToast.hidden=true,6000)}
const mobileQuery=matchMedia("(max-width: 820px)");
const appearance=document.querySelector(".appearance"),sidebar=document.querySelector(".sidebar"),mobileTools=document.querySelector("#mobile-tools");
const appearanceHome=appearance.parentNode,appearanceNext=appearance.nextSibling,sidebarHome=sidebar.parentNode,sidebarNext=sidebar.nextSibling;
function syncMobileLayout(){
  if(mobileQuery.matches){mobileTools.append(sidebar,appearance)}else{if(document.querySelector("#mobile-menu-dialog").open)document.querySelector("#mobile-menu-dialog").close();appearanceHome.insertBefore(appearance,appearanceNext);sidebarHome.insertBefore(sidebar,sidebarNext)}
}

document.querySelector("#search-form").addEventListener("submit",event=>{event.preventDefault();state.query=ui.search.value;render()});
ui.search.addEventListener("input",event=>{state.query=event.currentTarget.value;render()});
ui.clearSearch.addEventListener("click",()=>{state.query="";ui.search.value="";ui.search.focus();render()});
document.querySelector("#clear-filters").addEventListener("click",reset);
ui.face.addEventListener("change",event=>{document.documentElement.dataset.face=event.currentTarget.value;localStorage.setItem("cookbook-face",event.currentTarget.value)});
ui.dark.addEventListener("change",event=>{const theme=event.currentTarget.checked?"dark":"light";document.documentElement.dataset.theme=theme;localStorage.setItem("cookbook-theme",theme)});
document.addEventListener("click",event=>{const category=event.target.closest("[data-category]");const contributor=event.target.closest("[data-contributor]");const card=event.target.closest("[data-recipe]");if(category){state.category=state.category===category.dataset.category?"":category.dataset.category;render()}if(contributor){state.contributor=state.contributor===contributor.dataset.contributor?"":contributor.dataset.contributor;render()}if((category||contributor)&&mobileQuery.matches&&document.querySelector("#mobile-menu-dialog").open)document.querySelector("#mobile-menu-dialog").close();if(card)openRecipe(state.recipes.find(recipe=>recipe.slug===card.dataset.recipe))});
const surprise=()=>openRecipe(state.recipes[Math.floor(Math.random()*state.recipes.length)]);
document.querySelector("#surprise").addEventListener("click",surprise);
document.querySelector("#add-recipe").addEventListener("click",()=>ui.addDialog.showModal());
document.querySelector("#close-add").addEventListener("click",()=>ui.addDialog.close());
ui.addDialog.addEventListener("click",event=>{if(event.target===ui.addDialog)ui.addDialog.close()});
document.querySelector("#close-dev").addEventListener("click",()=>ui.devDialog.close());ui.devDialog.addEventListener("click",event=>{if(event.target===ui.devDialog)ui.devDialog.close()});ui.devSearch.addEventListener("input",renderDevList);
document.querySelector("#mobile-menu-button").addEventListener("click",()=>document.querySelector("#mobile-menu-dialog").showModal());document.querySelector("#close-mobile-menu").addEventListener("click",()=>document.querySelector("#mobile-menu-dialog").close());document.querySelector("#mobile-surprise").addEventListener("click",surprise);mobileQuery.addEventListener("change",syncMobileLayout);syncMobileLayout();
{
  const trigger=document.querySelector("#dev-trigger");const touchDevice=matchMedia("(pointer: coarse)").matches;let unlockTimer,taps=0,tapTimer;
  const cancel=()=>{clearTimeout(unlockTimer);trigger.classList.remove("unlocking")};
  if(touchDevice){trigger.addEventListener("click",event=>{event.preventDefault();taps+=1;clearTimeout(tapTimer);tapTimer=setTimeout(()=>taps=0,4000);if(taps>=7){taps=0;clearTimeout(tapTimer);openDevMenu()}})}
  else{trigger.addEventListener("pointerdown",event=>{event.preventDefault();cancel();trigger.classList.add("unlocking");trigger.setPointerCapture?.(event.pointerId);unlockTimer=setTimeout(openDevMenu,10000)});["pointerup","pointercancel","pointerleave"].forEach(name=>trigger.addEventListener(name,cancel))}
  trigger.addEventListener("contextmenu",event=>event.preventDefault());
}
document.querySelector("#recipe-form").addEventListener("submit",async event=>{
  event.preventDefault();const values=Object.fromEntries(new FormData(event.currentTarget));
  const form=event.currentTarget;const button=form.querySelector('button[type="submit"]');const status=document.querySelector("#form-status");
  button.disabled=true;button.textContent="Sending…";status.textContent="Sending recipe…";
  try{
    const response=await fetch(recipeSubmissionEndpoint,{method:"POST",headers:{Accept:"application/json","Content-Type":"application/json"},body:JSON.stringify(values)});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||`Submission ${response.status}`);
    form.reset();status.textContent="Submit when your recipe is ready.";button.disabled=false;button.textContent="Send recipe";ui.addDialog.close();showSubmissionToast("Recipe submitted for review. Thank you!");
  }catch(error){
    status.textContent=error.message||"The recipe could not be sent. Please try again.";button.disabled=false;button.textContent="Send recipe";console.error(error);
  }
});
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
