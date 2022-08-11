const taskName = 'Контакт без сделок';

const tasksCreateUrl = '/api/v4/tasks';

const limit = 25;

let page = 1;

let getContactsListQueryUrl = '/api/v4/contacts?order[id]=asc';

let tasksContactsQueryUrl = '/api/v4/tasks?filter[task_type]=1&filter[is_completed]=0&filter[entity_type]=contacts';

let ajaxCrossDomainCallers = {
  getContacts: {
    url: getContactsListQueryUrl,
    method: 'GET',
    done: getContactsDone,
    fail: getContactsFail
  },

  parseContacts: {
    url: tasksContactsQueryUrl,
    method: 'GET',
    done: parseContactsDone,
    fail: parseContactsFail
  },

  createTasksWithContacts: {
    url: tasksCreateUrl,
    method: 'POST',
    done: createTasksWithContactsDone,
    fail: createTasksWithContactsFail
  }
};

function ajaxCrossDomainCall(callerName, ajaxData) {
  if (callerName in ajaxCrossDomainCallers) {
    let ajaxCaller = ajaxCrossDomainCallers[callerName];
    let doneFn = ajaxCaller.done;
    let failFn = ajaxCaller.fail;
    if (typeof ajaxData !== 'string' && 'filter[entity_id]' in ajaxData) {
      doneFn = function(data) {
        ajaxCaller.done(data, ajaxData['filter[entity_id]']);
      }
    }

    $.ajax({
      crossDomain: true,
      url: ajaxCaller.url,
      method: ajaxCaller.method,
      data: ajaxData,
      dataType: 'json',
      headers: {
        Authorization: ""// Токен для авторизации
      }
    }).done(doneFn).fail(failFn);
  }
}

function getContacts() {
  ajaxCrossDomainCall('getContacts', {
    limit: limit,
    page: page,
    with: 'leads'
  });

  page++;
}


function getContactsDone(data) {
  if (!!data) {
    parseContacts(data._embedded.contacts);
    getContacts();
  } else {
    console.log('Контактов нет');
    return false;
  }
}


function getContactsFail(data) {
  console.log('Что-то пошло не так c получением контактов', data);
  return false;
}

function parseContacts(contacts) {
  let contactsWithoutLeads = getContactsWithoutLeads(contacts);
  if (!contactsWithoutLeads.length) {
    return false;
  }
  ajaxCrossDomainCall('parseContacts', {

    'filter[entity_id]': contactsWithoutLeads
  });
}

function parseContactsDone(data, contactsWithoutLeads) {
  if (!!data) {
    data._embedded.tasks.forEach(task => {
      if (task.text === taskName) {
        let contactIdx = contactsWithoutLeads.indexOf(task.entity_id);
        if (contactIdx > -1) {
          contactsWithoutLeads.splice(contactIdx, 1);
        }
      }
    });
  }
  createTasksWithContacts(contactsWithoutLeads);
}

function parseContactsFail(data) {
  console.log('Что-то пошло не так с поиском связанных задач', data);
  return false;
}

function createTasksWithContacts(contactsWithoutLeads) {
  let tasksToCreate = getTasksToCreate(contactsWithoutLeads);
  if (!tasksToCreate.length) {
    return false;
  }

  ajaxCrossDomainCall('createTasksWithContacts', '[' + tasksToCreate.join(",") + ']');
}


function createTasksWithContactsDone(data) {
  console.log('Новые задачи были созданы', data);
}


function createTasksWithContactsFail(data) {
  console.log('Что-то пошло не так с попыткой создать новые задачи', data);
  return false;
}

function getContactsWithoutLeads(contacts) {
  let contactsWithoutLeads = [];
  contacts.forEach(contact => {
    if (!contact._embedded.leads.length) {
      contactsWithoutLeads.push(contact.id);
    }
  });

  return contactsWithoutLeads;
}

function getTasksToCreate(contactsWithoutLeads) {

  let tasksToCreate = [];

  let completeTillUnixTimestamp = Math.floor(Date.now() / 1000 + 7 * 86400);
  
  contactsWithoutLeads.forEach(contactID => {
    tasksToCreate.push(
      JSON.stringify({
        entity_id: contactID,
        entity_type: 'contacts',
        text: taskName,
        complete_till: completeTillUnixTimestamp,
        task_type_id: 1
      })
    );
  });
  
  return tasksToCreate;
}
